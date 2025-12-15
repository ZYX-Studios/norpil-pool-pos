import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentMethod = "CASH" | "GCASH" | "CARD" | "WALLET" | "OTHER";

export interface CloseSessionParams {
	sessionId: string;
	method: PaymentMethod;
	tenderedAmount: number;
}

/**
 * Core implementation for closing a table session and recording a payment.
 *
 * This function is deliberately written to be usable from both:
 * - Server Actions (via createSupabaseServerClient)
 * - Client-side sync replayers (via createSupabaseBrowserClient)
 *
 * It contains no framework-specific logic (no redirects, no revalidatePath),
 * only database reads/writes through the provided Supabase client.
 *
 * Idempotency notes:
 * - If the order is no longer OPEN or already has a payment row, we treat the
 *   operation as a no-op and return without throwing. This lets a queued
 *   "sale_created" operation be safely replayed without double-charging.
 */
export async function closeSessionAndRecordPayment(
	supabase: SupabaseClient,
	{ sessionId, method, tenderedAmount }: CloseSessionParams,
) {
	// Load session, table rate, and open order.
	const [{ data: session, error: sessionErr }, { data: order, error: orderErr }] = await Promise.all([
		supabase
			.from("table_sessions")
			.select("id, opened_at, closed_at, status, override_hourly_rate, pool_table_id, session_type, target_duration_minutes, is_money_game, bet_amount, reservation_id, reservations(payment_status)")
			.eq("id", sessionId)
			.maybeSingle(),
		supabase
			.from("orders")
			.select("id, status, subtotal, tax_total, service_charge, discount_amount, total")
			.eq("table_session_id", sessionId)
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle(),
	]);

	if (sessionErr) throw sessionErr;
	if (orderErr) throw orderErr;
	if (!session || !order) {
		throw new Error("Session or order not found");
	}

	// If the order is already paid or closed, we treat this as a no-op so that
	// replayed operations do not double-close the session.
	// We allow active flow statuses (OPEN, PREPARING, READY, SERVED).
	const activeStatuses = ["OPEN", "PREPARING", "READY", "SERVED"];
	if (order.status && !activeStatuses.includes(order.status)) {
		return;
	}

	// If there is already at least one payment for this order, we also treat
	// this as a no-op. This guards against double-charging if a sync is retried.
	const { data: existingPayments, error: paymentsErr } = await supabase
		.from("payments")
		.select("id")
		.eq("order_id", order.id)
		.limit(1);
	if (paymentsErr) throw paymentsErr;
	if ((existingPayments ?? []).length > 0) {
		return;
	}

	// Fetch table hourly rate if a table is assigned.
	let tableHourlyRate = 0;
	if (session.pool_table_id) {
		const { data: tbl, error: tblErr } = await supabase
			.from("pool_tables")
			.select("hourly_rate")
			.eq("id", session.pool_table_id)
			.maybeSingle();
		if (tblErr) throw tblErr;
		if (!tbl) throw new Error("Pool table not found for session");
		tableHourlyRate = tbl.hourly_rate;
	}

	// Close session (set closed_at + status) if it is still marked OPEN.
	const closedAt = new Date();
	const { error: closeErr } = await supabase
		.from("table_sessions")
		.update({ status: "CLOSED", closed_at: closedAt.toISOString() })
		.eq("id", sessionId);
	if (closeErr) throw closeErr;

	// Compute final table fee using the robust logic (matching releaseTable).
	const openedAt = new Date(session.opened_at as string);
	const durationMs = Math.max(0, closedAt.getTime() - openedAt.getTime());
	const elapsedMinutes = Math.floor(durationMs / (1000 * 60));
	const hourlyRate = Number(session.override_hourly_rate ?? tableHourlyRate);

	let tableFee = 0;
	let isPrepaid = false;

	// Check prepaid status safely
	if ((session as any).reservation_id) {
		// Use the joined reservation data if available, or we might need to fetch if not joined (but we will join it)
		const res = (session as any).reservations;
		// Handle join returning array or object
		const paymentStatus = (Array.isArray(res) ? res[0] : res)?.payment_status;
		if (paymentStatus === 'PAID') {
			isPrepaid = true;
		}
	}

	const sessionType = (session as any).session_type || 'OPEN';
	const targetDuration = (session as any).target_duration_minutes;

	if (sessionType === 'FIXED' && targetDuration) {
		const baseFee = (targetDuration / 60) * hourlyRate;
		const excessMinutes = Math.max(0, elapsedMinutes - targetDuration);
		const excessFee = excessMinutes * (hourlyRate / 60);

		if (isPrepaid) {
			tableFee = excessFee;
		} else {
			tableFee = baseFee + excessFee;
		}
	} else {
		// Open Time Logic: 5 min grace, then 30m blocks
		if (elapsedMinutes > 5) {
			const blocks = Math.ceil(elapsedMinutes / 30);
			tableFee = blocks * 0.5 * hourlyRate;
		}
	}

	// Money Game Logic
	if ((session as any).is_money_game && (session as any).bet_amount) {
		const minFee = (session as any).bet_amount * 0.10;
		tableFee = Math.max(tableFee, minFee);
	}

	tableFee = Number(tableFee.toFixed(2));

	if (tableFee > 0 || isPrepaid) {
		// Even if fee is 0 (fully prepaid), we might want to record it? 
		// Actually if fee is 0, we don't need to charge.
		// But if it was Money Game and fee is > 0, we charge.

		if (tableFee > 0) {
			// Ensure TABLE_TIME product exists.
			const { data: tableTimeProduct, error: ttpErr } = await supabase
				.from("products")
				.select("id, category")
				.eq("name", "Table Time") // Match releaseTable selector (name vs sku) - use name to be safe or sku? 
				// releaseTable uses name="Table Time". closeSession used sku="TABLE_TIME".
				// Let's stick to name="Table Time" as per releaseTable to ensure we find the same product.
				.limit(1)
				.maybeSingle();

			// Fallback if not found by name, try SKU
			let timeProduct = tableTimeProduct;
			if (!timeProduct) {
				const { data: skuProd } = await supabase.from("products").select("id, category").eq("sku", "TABLE_TIME").maybeSingle();
				timeProduct = skuProd;
			}

			if (!timeProduct) {
				// Create if missing (fallback)
				const { data: newPro } = await supabase.from("products").insert({ name: "Table Time", category: "TABLE_TIME", price: 0, is_active: false }).select().single();
				timeProduct = newPro;
			}

			if (timeProduct) {
				// Upsert line item with Quantity 1, Price = tableFee
				const { data: existingLine, error: existingLineErr } = await supabase
					.from("order_items")
					.select("id")
					.eq("order_id", order.id)
					.eq("product_id", timeProduct.id)
					.maybeSingle();
				if (existingLineErr) throw existingLineErr;

				if (existingLine?.id) {
					const { error: updErr } = await supabase
						.from("order_items")
						.update({ quantity: 1, unit_price: tableFee, line_total: tableFee })
						.eq("id", existingLine.id);
					if (updErr) throw updErr;
				} else {
					const { error: insErr } = await supabase.from("order_items").insert({
						order_id: order.id,
						product_id: timeProduct.id,
						quantity: 1,
						unit_price: tableFee,
						line_total: tableFee,
					});
					if (insErr) throw insErr;
				}
			}
		}
	}

	// Recalculate final totals (including TABLE_TIME).
	const { data: allItems, error: itemsErr } = await supabase
		.from("order_items")
		.select("id, product_id, quantity, line_total, products(tax_rate, category)")
		.eq("order_id", order.id);
	if (itemsErr) throw itemsErr;

	let subtotal = 0;
	let taxTotal = 0;
	for (const row of allItems ?? []) {
		const line = Number((row as any).line_total ?? 0);
		const taxRate = Number((row as any).products?.tax_rate ?? 0);
		subtotal += line;
		taxTotal += Number((line * taxRate).toFixed(2));
	}
	const finalTotal = Number((subtotal + taxTotal).toFixed(2));

	// Prepare inventory movements for all non-table-time products in this order.
	const saleRows = (allItems ?? []).filter((row: any) => row.products?.category !== "TABLE_TIME");
	if (saleRows.length > 0) {
		const productIds = Array.from(
			new Set(
				saleRows
					.map((row: any) => row.product_id as string)
					.filter((id) => typeof id === "string" && id.length > 0),
			),
		);

		if (productIds.length > 0) {
			const { data: recipes, error: recipesErr } = await supabase
				.from("product_inventory_recipes")
				.select("product_id, inventory_item_id, quantity")
				.in("product_id", productIds);
			if (recipesErr) throw recipesErr;

			const recipeByProduct = new Map<string, Array<{ inventory_item_id: string; quantity: number }>>();
			for (const r of recipes ?? []) {
				const pid = r.product_id as string;
				const qtyPer = Number(r.quantity ?? 0);
				if (!pid || !Number.isFinite(qtyPer) || qtyPer <= 0) continue;
				const list = recipeByProduct.get(pid) ?? [];
				list.push({ inventory_item_id: r.inventory_item_id as string, quantity: qtyPer });
				recipeByProduct.set(pid, list);
			}

			const saleMovements: Array<{
				inventory_item_id: string;
				movement_type: "SALE";
				quantity: number;
				order_id: string;
				order_item_id: string;
			}> = [];

			for (const row of saleRows) {
				const pid = row.product_id as string;
				const qtySold = Number(row.quantity ?? 0);
				if (!pid || !Number.isFinite(qtySold) || qtySold === 0) continue;
				const safeQty = Math.abs(qtySold); // Allow fractional sales if needed, but usually whole.
				if (safeQty === 0) continue;
				const components = recipeByProduct.get(pid);
				if (!components || components.length === 0) {
					continue;
				}
				for (const comp of components) {
					const perUnit = Number(comp.quantity ?? 0);
					if (!Number.isFinite(perUnit) || perUnit <= 0) continue;
					const totalOut = safeQty * perUnit;
					if (!Number.isFinite(totalOut) || totalOut <= 0) continue;

					saleMovements.push({
						inventory_item_id: comp.inventory_item_id,
						movement_type: "SALE",
						quantity: -totalOut, // Use exact fractional amount
						order_id: order.id as string,
						order_item_id: row.id as string,
					});
				}
			}

			if (saleMovements.length > 0) {
				const { error: invErr } = await supabase.from("inventory_movements").insert(saleMovements);
				if (invErr) throw invErr;
			}
		}
	}

	// Amount we apply to the order is always the final total.
	const appliedAmount = finalTotal;

	// Insert payment (form already validated tenderedAmount > 0).
	const { error: payErr } = await supabase
		.from("payments")
		.insert({
			order_id: order.id,
			amount: appliedAmount,
			tendered_amount: tenderedAmount,
			method,
		});
	if (payErr) throw payErr;

	// Mark order paid.
	const { error: orderUpdErr } = await supabase
		.from("orders")
		.update({ status: "PAID", subtotal, tax_total: taxTotal, total: finalTotal })
		.eq("id", order.id);
	if (orderUpdErr) throw orderUpdErr;
}




