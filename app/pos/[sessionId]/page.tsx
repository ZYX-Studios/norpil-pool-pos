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
			.select("id, status, closed_at, opened_at, override_hourly_rate, customer_name, paused_at, accumulated_paused_time, session_type, target_duration_minutes, is_money_game, bet_amount, reservation_id, reservations(payment_status), pool_tables:pool_table_id(id, name, hourly_rate), profile_id, profiles(is_member)")
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
			.in("status", ["OPEN", "PREPARING", "READY", "SERVED", "PAID"])
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

		const stockMap = new Map<string, number>();
		for (const row of stockRows ?? []) {
			const pid = (row as any).product_id as string;
			const qty = Number((row as any).quantity_on_hand ?? 0);
			if (!pid) continue;
			stockMap.set(pid, Number.isFinite(qty) ? qty : 0);
		}

		// Load Global Settings for Member Discount
		const { data: memberSetting } = await supabase
			.from("app_settings")
			.select("value")
			.eq("key", "member_discount_percentage")
			.single();

		const discountPercent = Number(memberSetting?.value ?? 0);
		const isMember = (session as any).profiles?.is_member ?? false;

		let hourlyRate = Number(
			session.override_hourly_rate ?? (session as any).pool_tables?.hourly_rate ?? 0,
		);

		// Apply Member Discount (only if no override is set? Or always? Usually on base rate.)
		// Assumption: Override implies manual control, so valid overrides might skip discount.
		// However, simpler logic: If it's the base table rate, apply discount. If override is present, use override.
		// Re-reading: "override_hourly_rate" is usually null unless set manually.
		if (!session.override_hourly_rate && isMember && discountPercent > 0) {
			hourlyRate = hourlyRate * ((100 - discountPercent) / 100);
		}

		return (
			<>
				<SessionClient
					sessionId={sessionId}
					tableName={(session as any).pool_tables?.name ?? (session as any).customer_name ?? "Walk-in"}
					customerName={(session as any).customer_name}
					isMember={isMember}
					discountPercent={isMember ? discountPercent : 0}
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
