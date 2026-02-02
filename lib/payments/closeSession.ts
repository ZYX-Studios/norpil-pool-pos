import type { SupabaseClient } from "@supabase/supabase-js";

type PaymentMethod = "CASH" | "GCASH" | "CARD" | "WALLET" | "OTHER";

export interface CloseSessionParams {
	sessionId: string;
	method: PaymentMethod;
	tenderedAmount: number;
	profileId?: string; // Optional member tagging
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
 * - If the order is already PAID, we treat the operation as a no-op.
 * - Prior behavior: If *any* payment existed, it successfully returned. 
 *   NEW behavior: We allow multiple payments until the total covers the bill.
 */
export async function closeSessionAndRecordPayment(
	supabase: SupabaseClient,
	{ sessionId, method, tenderedAmount, profileId }: CloseSessionParams,
) {
	// Load session, table rate, and open order.
	const [{ data: session, error: sessionErr }, { data: order, error: orderErr }] = await Promise.all([
		supabase
			.from("table_sessions")
			.select("id, opened_at, closed_at, status, override_hourly_rate, pool_table_id, session_type, target_duration_minutes, is_money_game, bet_amount, reservation_id, reservations(payment_status), paused_at, accumulated_paused_time, profile_id")
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

	// 1. Idempotency / Status Checks
	const activeStatuses = ["OPEN", "PREPARING", "READY", "SERVED"];
	if (order.status && !activeStatuses.includes(order.status)) {
		// If explicitly PAID or CANCELLED, stop.
		// Note: We used to check if *any* payment existed. Now we check status first.
		if (order.status === 'PAID') return;
	}

	// 2. Fetch Existing Payments to Check if Fully Paid
	const { data: existingPayments, error: paymentsErr } = await supabase
		.from("payments")
		.select("amount")
		.eq("order_id", order.id);

	if (paymentsErr) throw paymentsErr;

	const previouslyPaid = (existingPayments ?? []).reduce((sum, p) => sum + Number(p.amount), 0);

	// 3. Compute Table Fee & Final Total (Logic duplicated to ensure accuracy at moment of payment)
	// Refactor note: Ideally this logic lives in one shared calculator function.

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

	// Determine "End Time" for calculation:
	// - If session is already closed (edge case?), use closed_at.
	// - If partially paid, do we freeze time? 
	//   DECISION: The first partial payment effectively "locks" the bill by inserting the TABLE_TIME product.
	//   So subsequent calls will find the product and not re-calculate dynamic time.
	//   We verify if TABLE_TIME exists first.

	const { data: existingTimeItem } = await supabase
		.from("order_items")
		.select("id, line_total, products!inner(category)")
		.eq("order_id", order.id)
		.eq("products.category", "TABLE_TIME")
		.limit(1)
		.maybeSingle();

	let tableFee = 0;
	let isTimeFixed = !!existingTimeItem;

	if (isTimeFixed) {
		// If we already have a table time item, we use its value.
		tableFee = Number(existingTimeItem?.line_total ?? 0);
	} else {
		// Calculate fresh
		const now = new Date(); // Use NOW as the closing time reference
		const openedAt = new Date(session.opened_at as string);

		// If session is paused, we don't count paused time. 
		// If session was already released (no pool_table_id?), time stopped at paused_at?
		// Logic matches `ClientTimer` and `releaseTable`.

		let endTime = now;
		// If session is officially closed?
		if (session.closed_at) endTime = new Date(session.closed_at);
		// If paused, time effectively stops at pause (for current fee calc)? 
		// Actually, `accumulated_paused_time` handles the past pauses. 
		// If currently paused, we pause "now" - "paused_at" extra? 
		// For payment, we usually assume "Stop everything now".

		const durationMs = Math.max(0, endTime.getTime() - openedAt.getTime());
		// Subtract accumulated pause
		const accumulated = (session.accumulated_paused_time || 0) * 1000;
		// Subtract current pause duration if valid?
		let currentPauseDeduction = 0;
		if (session.paused_at) {
			currentPauseDeduction = Math.max(0, endTime.getTime() - new Date(session.paused_at).getTime());
		}

		const effectiveDurationMs = Math.max(0, durationMs - accumulated - currentPauseDeduction);
		const elapsedMinutes = Math.floor(effectiveDurationMs / (1000 * 60));

		// DISCOUNT LOGIC
		let hourlyRate = Number(session.override_hourly_rate ?? tableHourlyRate);

		// Only apply discount if NO override is set (override takes precedence)
		if (!session.override_hourly_rate && session.pool_table_id && session.profile_id) {
			// 1. Fetch Profile & Tier
			// We need to fetch this separately because the initial session query didn't join deeply to avoid massive data invalidation risk
			// or we can just do a quick lookup now.
			const { data: profileData } = await supabase
				.from("profiles")
				.select("is_member, membership_tiers(discount_percentage)")
				.eq("id", session.profile_id)
				.single();

			if (profileData) {
				const { data: memberSetting } = await supabase
					.from("app_settings")
					.select("value")
					.eq("key", "member_discount_percentage")
					.single();

				const globalDiscount = Number(memberSetting?.value ?? 0);
				let effectiveDiscount = 0;

				// Handle array or object return
				const tierData = Array.isArray(profileData.membership_tiers)
					? profileData.membership_tiers[0]
					: profileData.membership_tiers;

				if (tierData && tierData.discount_percentage != null) {
					effectiveDiscount = Number(tierData.discount_percentage);
				} else if (profileData.is_member) {
					effectiveDiscount = globalDiscount;
				}

				if (effectiveDiscount > 0) {
					hourlyRate = hourlyRate * ((100 - effectiveDiscount) / 100);
				}
			}
		}

		let isPrepaid = false;
		if ((session as any).reservation_id) {
			const res = (session as any).reservations;
			const paymentStatus = (Array.isArray(res) ? res[0] : res)?.payment_status;
			if (paymentStatus === 'PAID') isPrepaid = true;
		}

		const sessionType = (session as any).session_type || 'OPEN';
		const targetDuration = (session as any).target_duration_minutes;

		if (sessionType === 'FIXED' && targetDuration) {
			const baseFee = (targetDuration / 60) * hourlyRate;
			const excessMinutes = Math.max(0, elapsedMinutes - targetDuration);
			const excessFee = excessMinutes * (hourlyRate / 60);
			tableFee = isPrepaid ? excessFee : baseFee + excessFee;
		} else {
			if (elapsedMinutes > 5) {
				const blocks = Math.ceil(elapsedMinutes / 30);
				tableFee = blocks * 0.5 * hourlyRate;
			}
		}

		if ((session as any).is_money_game && (session as any).bet_amount) {
			const minFee = (session as any).bet_amount * 0.10;
			tableFee = Math.max(tableFee, minFee);
		}
		tableFee = Number(tableFee.toFixed(2));
	}

	// 4. Update/Insert Table Time Item to DB (Locking the fee)
	// We do this even for partial payments to freeze the time charge.
	if (!isTimeFixed && (tableFee > 0)) {
		// Find/Create product
		let { data: timeProduct } = await supabase
			.from("products")
			.select("id")
			.eq("name", "Table Time")
			.limit(1)
			.maybeSingle();

		if (!timeProduct) {
			const { data: skuProd } = await supabase.from("products").select("id").eq("sku", "TABLE_TIME").maybeSingle();
			timeProduct = skuProd;
		}

		if (!timeProduct) {
			const { data: newPro } = await supabase.from("products").insert({ name: "Table Time", category: "TABLE_TIME", price: 0, is_active: false }).select().single();
			timeProduct = newPro;
		}

		if (timeProduct) {
			// Insert item
			await supabase.from("order_items").insert({
				order_id: order.id,
				product_id: timeProduct.id,
				quantity: 1,
				unit_price: tableFee,
				line_total: tableFee,
			});
			// Flag it so we don't re-add below (though isTimeFixed check above handles next run)
		}
	}

	// 5. Recalculate Totals (Sum of all items including newly added Time)
	const { data: allItems, error: itemsErr } = await supabase
		.from("order_items")
		.select("id, product_id, quantity, line_total, products(tax_rate, category)")
		.eq("order_id", order.id);
	if (itemsErr) throw itemsErr;

	let subtotal = 0;
	let taxTotal = 0;
	// We also need to identify sale items for inventory
	const saleRows = [];

	for (const row of allItems ?? []) {
		const line = Number((row as any).line_total ?? 0);
		const taxRate = Number((row as any).products?.tax_rate ?? 0);
		subtotal += line;
		taxTotal += Number((line * taxRate).toFixed(2));

		if ((row as any).products?.category !== "TABLE_TIME") {
			saleRows.push(row);
		}
	}
	const finalTotal = Number((subtotal + taxTotal).toFixed(2));

	// 6. Record the Payment
	// We always record the tendered amount.
	// We handle tracking "applied" amount implicitly by checking sums?
	// Actually, `amount` field in `payments` is usually "Amount allocated to order".
	// `tendered_amount` is what they gave.
	// For partials, amount = tendered usually (or less if overpaid?).
	// Simplification: amount = tendered.

	const { error: payErr } = await supabase
		.from("payments")
		.insert({
			order_id: order.id,
			amount: tenderedAmount,
			tendered_amount: tenderedAmount,
			method,
			profile_id: profileId || null, // Tag member
		});
	if (payErr) throw payErr;


	// 7. Check if Fully Paid
	const totalPaidNow = previouslyPaid + tenderedAmount;

	// EPSILON check for float precision
	const isFullyPaid = (totalPaidNow + 0.01) >= finalTotal;

	if (isFullyPaid) {
		// --- FINAL CLOSE ---

		// 1. Inventory Deduction
		// REMOVED: Moved to Database Trigger on Order Status Change (SUBMITTED/SERVED).
		// This prevents double deduction and ensures stock is taken when order is committed, not just paid.


		// 2. Update Order Status
		await supabase
			.from("orders")
			.update({ status: "PAID", subtotal, tax_total: taxTotal, total: finalTotal })
			.eq("id", order.id);

		// 3. Close Session
		const closedAtCtx = new Date();
		await supabase
			.from("table_sessions")
			.update({ status: "CLOSED", closed_at: closedAtCtx.toISOString() })
			.eq("id", sessionId);

	} else {
		// --- PARTIAL PAYMENT ---
		// Just update totals on the order so they reflect the "Locked" state if we added table time.
		await supabase
			.from("orders")
			.update({ subtotal, tax_total: taxTotal, total: finalTotal })
			.eq("id", order.id);

		// Ensure session remains OPEN (it is by default).
		// We might want to "Pause" the timer here explicitly if we added table time?
		// User requirement isn't explicit, but if we charged "Table Time", we shouldn't keep charging.
		// Logic: If TABLE_TIME item exists, we consider time "Stopped" for billing.
		// Using `paused_at` updates is good for UI.
		if (!session.paused_at) {
			await supabase
				.from("table_sessions")
				.update({ paused_at: new Date().toISOString() })
				.eq("id", sessionId);
		}
	}
}




