export const dynamic = 'force-dynamic';
import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SessionClient } from "./SessionClient";


export default async function SessionPage({
	params,
	searchParams,
}: {
	params: Promise<{ sessionId: string }>;
	searchParams: Promise<Record<string, string | string[]>>;
}) {
	const supabase = createSupabaseServerClient();
	const { sessionId } = await params;
	const sp = await searchParams;
	const errorCode = sp?.error as string | undefined;



	try {
		// Load session + table
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.select("id, status, closed_at, opened_at, override_hourly_rate, customer_name, paused_at, accumulated_paused_time, session_type, target_duration_minutes, is_money_game, bet_amount, reservation_id, reservations(payment_status), pool_tables:pool_table_id(id, name, hourly_rate), profile_id, profiles(is_member, membership_tiers(discount_percentage))")
			.eq("id", sessionId)
			.maybeSingle();

		if (sessionErr) {
			throw sessionErr;
		}

		if (!session) {
			return notFound();
		}

		// Gracefully handle CLOSED sessions (redirect to home)
		if (session.status === 'CLOSED' || session.closed_at) {
			redirect('/pos');
		}


		// Load open order (robust handling for duplicates)
		// We fetch ALL candidates to pick the "real" one and ignore empty duplicates created by bugs.
		let { data: candidates, error: orderErr } = await supabase
			.from("orders")
			.select("id, status, created_at, last_submitted_item_count, order_items(id)") // fetch items count to score
			.eq("table_session_id", sessionId)
			.in("status", ["OPEN", "SUBMITTED", "PREPARING", "READY", "SERVED", "PAID"])
			.order("created_at", { ascending: false });

		if (orderErr) {
			throw orderErr;
		}

		let order = null;
		if (candidates && candidates.length > 0) {
			// Scoring: Has Items > Latest
			// Actually, if we have a SERVED order with items and an OPEN order with no items (duplicate), we want the SERVED one.
			// But if we have an OPEN order with NEW items and a SERVED order with OLD items... that implies two orders.
			// System design assumes SINGLE order per session usually.
			// Let's assume the "Main" order is the one with the most items, or the latest if            // Sort by has_items desc, then created_at desc
			candidates.sort((a, b) => {
				const aCount = a.order_items?.length || 0;
				const bCount = b.order_items?.length || 0;
				if (aCount !== bCount) return bCount - aCount; // More items first
				return new Date(b.created_at).getTime() - new Date(a.created_at).getTime(); // Newer first
			});
			order = candidates[0] as { id: string; status: string; created_at: string; order_items: any[]; last_submitted_item_count: number }; // assert type

			// Optional: Identify empty duplicates to maybe cleanup? 
			// Risky to auto-delete in production without being sure, but logging is good.
			if (candidates.length > 1) {
				console.warn(`[SessionPage] Multiple active orders found for session ${sessionId}. Selected ${order.id} (${order.status}, ${order.order_items?.length || 0} items).`);
			}
		}

		// Self-healing: If session is OPEN but no order exists (orphan session), create one.
		if (!order && session.status === 'OPEN') {
			console.warn(`[SessionPage] Orphan session found (id=${sessionId}). creating missing order.`);
			const { data: newOrder, error: createErr } = await supabase
				.from("orders")
				.insert({
					table_session_id: sessionId,
					status: "OPEN",
				})
				.select("id, status, created_at, last_submitted_item_count") // Select status to match type
				.single();

			if (createErr) {
				console.error("[SessionPage] Failed to heal orphan session:", createErr);
				throw createErr;
			}
			order = newOrder as { id: string; status: string; created_at: string; last_submitted_item_count: number };
		}

		// If we still don't have an order (and didn't correct it), then 404.
		if (!order) return notFound();

		// Load items with product info (including tax_rate for totals).
		const { data: items, error: itemsErr } = await supabase
			.from("order_items")
			.select("id, product_id, quantity, served_quantity, unit_price, line_total, products(name, category, tax_rate)")
			.eq("order_id", order.id)
			.order("created_at", { ascending: true });
		if (itemsErr) {
			throw itemsErr;
		}

		// Load active products
		const { data: products, error: productsErr } = await supabase
			.from("products")
			.select("id, name, category, price, tax_rate, is_active")
			.eq("is_active", true)
			.order("name", { ascending: true });
		if (productsErr) {
			throw productsErr;
		}

		// Load current stock for all products to drive soft stock warnings in the POS.
		const { data: stockRows, error: stockErr } = await supabase
			.from("product_stock")
			.select("product_id, quantity_on_hand");
		if (stockErr) {
			throw stockErr;
		}

		// Load Inventory & Recipes to Calculate "Potential Stock"
		const { data: recipeRows, error: recipeErr } = await supabase
			.from("product_inventory_recipes")
			.select("product_id, inventory_item_id, quantity");

		if (recipeErr) throw recipeErr;

		const { data: inventoryRows, error: inventoryErr } = await supabase
			.from("inventory_item_stock")
			.select("inventory_item_id, quantity_on_hand");

		if (inventoryErr) throw inventoryErr;

		// 1. Map Inventory Stock
		const inventoryMap = new Map<string, number>();
		for (const row of inventoryRows ?? []) {
			inventoryMap.set(row.inventory_item_id, Number(row.quantity_on_hand ?? 0));
		}

		// 2. Map Recipes
		type RecipeItem = { ingredientId: string; requiredQty: number };
		const recipeMap = new Map<string, RecipeItem[]>();
		for (const row of recipeRows ?? []) {
			const pid = row.product_id;
			if (!recipeMap.has(pid)) recipeMap.set(pid, []);
			recipeMap.get(pid)?.push({
				ingredientId: row.inventory_item_id,
				requiredQty: Number(row.quantity)
			});
		}

		// 3. Build Final Stock Map
		const stockMap = new Map<string, number>();

		// Start with Direct Stock
		for (const row of stockRows ?? []) {
			const pid = (row as any).product_id as string;
			const qty = Number((row as any).quantity_on_hand ?? 0);
			if (!pid) continue;
			stockMap.set(pid, Number.isFinite(qty) ? qty : 0);
		}

		// Calculate Potential from Recipes and take MAX
		for (const p of products ?? []) {
			const pid = p.id;
			const directStock = stockMap.get(pid) ?? 0;
			const recipe = recipeMap.get(pid);

			if (recipe && recipe.length > 0) {
				let maxPotential = Infinity;

				for (const ing of recipe) {
					const available = inventoryMap.get(ing.ingredientId) ?? 0;
					if (ing.requiredQty > 0) {
						const canMake = Math.floor(available / ing.requiredQty);
						if (canMake < maxPotential) {
							maxPotential = canMake;
						}
					}
				}

				if (maxPotential === Infinity) maxPotential = 0; // Should not happen given check above, but safety

				// LOGIC FIX: User has confirmed mixed usage.
				// We use the MAX of Direct vs Potential. 
				// Example: Cup Noodles (22 direct, 22 potential) -> 22.
				// Example: Clubhouse (0 direct, 10 potential) -> 10.
				const finalStock = Math.max(directStock, maxPotential);
				stockMap.set(pid, finalStock);
			}
		}

		// Load Global Settings for Member Discount
		const { data: memberSetting } = await supabase
			.from("app_settings")
			.select("value")
			.eq("key", "member_discount_percentage")
			.single();

		const globalDiscountPercent = Number(memberSetting?.value ?? 0);
		const profile = (session as any).profiles;
		const isMember = profile?.is_member ?? false;

		// Determine effective discount
		// 1. Tier discount has priority
		// 2. Fallback to global discount if is_member is true
		let effectiveDiscount = 0;

		// Handle array or object return from Supabase relation
		const tierData = Array.isArray(profile?.membership_tiers)
			? profile.membership_tiers[0]
			: profile?.membership_tiers;

		if (tierData && tierData.discount_percentage != null) {
			effectiveDiscount = Number(tierData.discount_percentage);
		} else if (isMember) {
			effectiveDiscount = globalDiscountPercent;
		}

		let hourlyRate = Number(
			session.override_hourly_rate ?? (session as any).pool_tables?.hourly_rate ?? 0,
		);

		// Load existing payments sum to determine partial status
		const { data: existingPayments } = await supabase
			.from("payments")
			.select("amount")
			.eq("order_id", order.id);

		const totalPaid = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);


		// Apply Effective Discount
		if (!session.override_hourly_rate && effectiveDiscount > 0) {
			hourlyRate = hourlyRate * ((100 - effectiveDiscount) / 100);
		}

		return (
			<>
				<SessionClient
					sessionId={sessionId}
					tableName={(session as any).pool_tables?.name ?? (session as any).customer_name ?? "Walk-in"}
					customerName={(session as any).customer_name}
					isMember={isMember}
					discountPercent={isMember ? effectiveDiscount : 0}
					openedAt={session.opened_at as string}
					hourlyRate={hourlyRate}
					orderId={order.id as string}
					initialItems={(items ?? []).map((i: any) => ({
						id: i.id as string,
						productId: i.product_id as string,
						name: i.products?.name as string,
						category: i.products?.category as any,
						unitPrice: Number(i.unit_price),
						quantity: Number(i.quantity),
						servedQuantity: Number(i.served_quantity || 0),
						lineTotal: Number(i.line_total),
						taxRate: Number(i.products?.tax_rate ?? 0),
					}))}
					products={(products ?? []).map((p: any) => ({
						id: p.id as string,
						name: p.name as string,
						category: p.category as any,
						price: Number(p.price),
						taxRate: Number(p.tax_rate ?? 0),
						stock: stockMap.get(p.id as string) ?? 0,
					}))}
					errorCode={errorCode}
					orderStatus={order.status}
					lastSubmittedItemCount={order.last_submitted_item_count || 0}
					pausedAt={session.paused_at}
					accumulatedPausedTime={session.accumulated_paused_time}
					isTableSession={!!(session as any).pool_tables}
					sessionType={(session as any).session_type}
					targetDurationMinutes={(session as any).target_duration_minutes}
					isMoneyGame={(session as any).is_money_game}
					betAmount={(session as any).bet_amount}
					isPrepaid={(() => {
						const r = (session as any).reservations;
						const status = Array.isArray(r) ? r[0]?.payment_status : r?.payment_status;
						return status === 'PAID';
					})()}
					totalPaid={totalPaid}
				/>
			</>
		);
	} catch (error: any) {
		console.error("Failed to load POS session page. Error details:", {
			message: error?.message,
			code: error?.code,
			details: error?.details,
			hint: error?.hint,
			full: JSON.stringify(error, null, 2)
		});
		throw error;
	}
}
