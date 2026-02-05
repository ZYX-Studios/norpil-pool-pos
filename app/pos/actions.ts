'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logger";


export type OpenTableData = {
	poolTableId: string;
	sessionType: "OPEN" | "FIXED";
	targetDurationMinutes?: number;
	isMoneyGame: boolean;
	betAmount?: number;
	customerName?: string;
	profileId?: string;
};

export async function openTableAction(data: OpenTableData) {
	const supabase = createSupabaseServerClient();
	const { poolTableId, sessionType, targetDurationMinutes, isMoneyGame, betAmount, customerName, profileId } = data;

	try {
		// Find a existing OPEN session for this table (idempotency safeguard)
		const { data: existing, error: existingErr } = await supabase
			.from("table_sessions")
			.select("id, status")
			.eq("pool_table_id", poolTableId)
			.eq("status", "OPEN")
			.limit(1)
			.maybeSingle();

		if (existingErr) {
			throw existingErr;
		}
		if (existing?.id) {
			redirect(`/pos/${existing.id}`);
		}

		// Fetch table details for location_name
		const { data: tableData } = await supabase
			.from("pool_tables")
			.select("name")
			.eq("id", poolTableId)
			.single();

		// Create session
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.insert({
				pool_table_id: poolTableId,
				status: "OPEN",
				session_type: sessionType,
				target_duration_minutes: targetDurationMinutes,
				is_money_game: isMoneyGame,
				bet_amount: betAmount,
				customer_name: customerName,
				profile_id: profileId,
				location_name: tableData?.name,
			})
			.select("id")
			.single();

		if (sessionErr || !session) {
			throw sessionErr ?? new Error("Failed to create table session.");
		}

		// Create an OPEN order for this session
		const { error: orderErr } = await supabase.from("orders").insert({
			table_session_id: session.id,
			status: "OPEN",
		});
		if (orderErr) {

			throw orderErr;
		}

		revalidatePath("/pos");

		await logAction({
			actionType: "OPEN_TABLE",
			entityType: "table_session",
			entityId: session.id,
			details: { poolTableId, sessionType, isMoneyGame },
		});

		redirect(`/pos/${session.id}`);
	} catch (error) {
		// If this is a Next.js redirect error, rethrow so navigation works.
		// Redirects are implemented as throws with a special digest; treating
		// them as real failures would break the normal "redirect to session"
		// flow when opening a table online.
		if (error && typeof error === "object" && "digest" in error && typeof (error as any).digest === "string") {
			throw error;
		}

		// When offline or when Supabase is unreachable, we land here instead of
		// crashing the server action. We redirect back to the POS home with a
		// simple error code so the UI can show a friendly message.
		console.error("openTableAction failed", error);
		redirect("/pos?error=open_table");
	}
}

export async function createWalkInSession(customerName: string, profileId?: string) {
	const supabase = createSupabaseServerClient();

	try {
		// Create session with no table (pool_table_id is null)
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.insert({
				pool_table_id: null,
				customer_name: customerName,
				status: "OPEN",
				profile_id: profileId,
				location_name: "Walk-in"
			})
			.select("id")
			.single();


		if (sessionErr || !session) {
			throw sessionErr ?? new Error("Failed to create walk-in session.");
		}

		// Create an OPEN order for this session
		const { error: orderErr } = await supabase.from("orders").insert({
			table_session_id: session.id,
			status: "OPEN",
		});
		if (orderErr) {
			throw orderErr;
		}

		revalidatePath("/pos");

		await logAction({
			actionType: "CREATE_WALK_IN",
			entityType: "table_session",
			entityId: session.id,
			details: { customerName },
		});

		redirect(`/pos/${session.id}`);
	} catch (error) {
		if (error && typeof error === "object" && "digest" in error && typeof (error as any).digest === "string") {
			throw error;
		}
		console.error("createWalkInSession failed", error);
		redirect("/pos?error=create_walk_in");
	}
}

export async function updateSessionCustomerName(sessionId: string, name: string, profileId?: string) {
	const supabase = createSupabaseServerClient();

	try {
		const { error } = await supabase
			.from("table_sessions")
			.update({ customer_name: name, profile_id: profileId || null })
			.eq("id", sessionId);

		if (error) {
			throw error;
		}

		revalidatePath("/pos");
		revalidatePath(`/pos/${sessionId}`);

		await logAction({
			actionType: "UPDATE_CUSTOMER_NAME",
			entityType: "table_session",
			entityId: sessionId,
			details: { name },
		});
	} catch (error) {
		console.error("updateSessionCustomerName failed", error);
		throw new Error("Failed to update customer name.");
	}
}

export async function pauseSession(sessionId: string) {
	const supabase = createSupabaseServerClient();

	try {
		const { error } = await supabase
			.from("table_sessions")
			.update({ paused_at: new Date().toISOString() })
			.eq("id", sessionId);

		if (error) {
			throw error;
		}

		revalidatePath("/pos");
		revalidatePath(`/pos/${sessionId}`);

		await logAction({
			actionType: "PAUSE_SESSION",
			entityType: "table_session",
			entityId: sessionId,
		});
	} catch (error) {
		console.error("pauseSession failed", error);
		throw new Error("Failed to pause session.");
	}
}

export async function resumeSession(sessionId: string) {
	const supabase = createSupabaseServerClient();

	try {
		// First get the current paused_at and accumulated_paused_time
		const { data: session, error: fetchError } = await supabase
			.from("table_sessions")
			.select("paused_at, accumulated_paused_time")
			.eq("id", sessionId)
			.single();

		if (fetchError || !session || !session.paused_at) {
			throw fetchError ?? new Error("Session is not paused");
		}

		const pausedAt = new Date(session.paused_at).getTime();
		const now = Date.now();
		const additionalPausedTime = Math.floor((now - pausedAt) / 1000); // in seconds
		const newAccumulatedTime = (session.accumulated_paused_time || 0) + additionalPausedTime;

		const { error: updateError } = await supabase
			.from("table_sessions")
			.update({
				paused_at: null,
				accumulated_paused_time: newAccumulatedTime,
			})
			.eq("id", sessionId);

		if (updateError) {
			throw updateError;
		}

		revalidatePath("/pos");
		revalidatePath(`/pos/${sessionId}`);

		await logAction({
			actionType: "RESUME_SESSION",
			entityType: "table_session",
			entityId: sessionId,
			details: { accumulatedPausedTime: newAccumulatedTime },
		});
	} catch (error) {
		console.error("resumeSession failed", error);
		throw new Error("Failed to resume session.");
	}
}

export async function releaseTable(sessionId: string, customerName?: string) {
	const supabase = createSupabaseServerClient();

	try {
		// 1. Fetch session details to calculate final table time
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.select(`
				*,
				pool_table:pool_tables!table_sessions_pool_table_id_fkey(id, name, hourly_rate),
				orders(id)
			`)
			.eq("id", sessionId)
			.limit(1)
			.single();


		if (sessionErr || !session) {
			throw sessionErr ?? new Error("Session not found");
		}

		const orderId = session.orders?.[0]?.id;
		if (!orderId) {
			// If no order, we can't add table time, but we should still release the table?
			// For now, let's proceed but warn.
			console.warn("[releaseTable] No order found for session", sessionId);
		}

		let isPrepaid = false;

		// Compute Fee
		const nowMs = Date.now();
		const openedMs = new Date(session.opened_at).getTime();
		const accumulated = (session.accumulated_paused_time || 0) * 1000;
		let elapsedMs = 0;
		if (session.paused_at) {
			elapsedMs = Math.max(0, new Date(session.paused_at).getTime() - openedMs - accumulated);
		} else {
			elapsedMs = Math.max(0, nowMs - openedMs - accumulated);
		}
		const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));

		let hourlyRate = Number(session.override_hourly_rate ?? session.pool_table?.hourly_rate ?? 0);

		// DISCOUNT LOGIC (Mirrors closeSessionAndRecordPayment)
		if (!session.override_hourly_rate && session.pool_table_id && session.profile_id) {
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
		let tableFee = 0;

		const sessionType = session.session_type || "OPEN";
		if (sessionType === "FIXED" && session.target_duration_minutes) {
			const baseFee = (session.target_duration_minutes / 60) * hourlyRate;
			const excessMinutes = Math.max(0, elapsedMinutes - session.target_duration_minutes);
			const excessFee = excessMinutes * (hourlyRate / 60);
			tableFee = baseFee + excessFee;
		} else {
			// Open Time default
			if (elapsedMinutes > 5) {
				const blocks = Math.ceil(elapsedMinutes / 30);
				tableFee = blocks * 0.5 * hourlyRate;
			}
		}

		if (session.is_money_game && session.bet_amount) {
			tableFee = Math.max(tableFee, session.bet_amount * 0.10);
		}

		tableFee = Number(tableFee.toFixed(2));

		if (session.reservation_id) {
			const { data: res } = await supabase
				.from("reservations")
				.select("payment_status")
				.eq("id", session.reservation_id)
				.limit(1)
				.single();

			if (res?.payment_status === 'PAID') {
				isPrepaid = true;
			}
		}

		// ...

		// Let's look for a "Table Time" product.
		const { data: timeProduct } = await supabase
			.from("products")
			.select("id")
			.eq("name", "Table Time")
			.limit(1)
			.maybeSingle();

		const timeProductId = timeProduct?.id;

		if (timeProductId) {
			// Check if we already added this product to this order
			const { data: existingTimeItem } = await supabase
				.from("order_items")
				.select("id")
				.eq("order_id", orderId)
				.eq("product_id", timeProductId)
				.limit(1)
				.maybeSingle();

			if (!existingTimeItem) {
				// ... replace
				const { error: insertErr } = await supabase.from("order_items").insert({
					order_id: orderId,
					product_id: timeProductId,
					quantity: 1,
					unit_price: tableFee,
					line_total: tableFee
				});
				if (insertErr) {
					console.error("[releaseTable] Failed to insert table time item:", insertErr);
					// We don't throw here to allow the release to proceed, 
					// but ideally this should work.
				}
			}
		} else {
			console.log("[releaseTable] Skipping table time item. Fee:", tableFee, "Order:", session.orders?.[0]?.id);
		}

		// 4. Update session: release table, set customer name, and PAUSE the timer permanently (or effectively stop it)
		// We set paused_at to NOW if it wasn't paused, so the time stops counting.

		const currentTableId = session.pool_table_id;
		const currentTableName = session.pool_table?.name;

		const updates: any = {
			pool_table_id: null,
			released_from_table_id: currentTableId, // Save the ID!
			// If not already paused, pause it now to "stop" the timer.
			paused_at: session.paused_at || new Date().toISOString()
		};

		// Ensure location_name is set to the table name if we have it
		// This fixes the visual bug where it shows "Walk-in" or blank
		if (currentTableName) {
			updates.location_name = currentTableName;
		}

		if (customerName) {
			updates.customer_name = customerName;
		}

		const { error } = await supabase
			.from("table_sessions")
			.update(updates)
			.eq("id", sessionId);

		if (error) {
			throw error;
		}

		revalidatePath("/pos");
		revalidatePath(`/pos/${sessionId}`);


		// 5. Recalculate Totals
		const { data: allItems, error: itemsErr } = await supabase
			.from("order_items")
			.select("quantity, line_total, products(tax_rate)")
			.eq("order_id", orderId);

		if (itemsErr) {
			console.error("[releaseTable] Failed to fetch items for recalc:", itemsErr);
		} else {
			let subtotal = 0;
			let taxTotal = 0;
			for (const row of allItems ?? []) {
				const line = Number(row.line_total ?? 0);
				// @ts-ignore - Supabase types join inference
				const products: any = row.products;
				const taxRate = Number((Array.isArray(products) ? products[0]?.tax_rate : products?.tax_rate) ?? 0);
				subtotal += line;
				taxTotal += Number((line * taxRate).toFixed(2));
			}
			const finalTotal = Number((subtotal + taxTotal).toFixed(2));

			// Update Order
			const { error: updErr } = await supabase
				.from("orders")
				.update({ subtotal, tax_total: taxTotal, total: finalTotal })
				.eq("id", orderId);

			if (updErr) {
				console.error("[releaseTable] Failed to update order totals:", updErr);
			}
		}

		await logAction({
			actionType: "RELEASE_TABLE",
			entityType: "table_session",
			entityId: sessionId,
			details: { customerName, finalTableFee: tableFee },
		});
	} catch (error) {
		console.error("releaseTable failed", error);
		throw new Error("Failed to release table.");
	}
}



export async function checkInReservation(reservationId: string, options?: { useCurrentTime?: boolean }) {
	const supabase = createSupabaseServerClient();
	const useCurrentTime = options?.useCurrentTime ?? false;

	try {
		// 1. Get Reservation
		const { data: reservation, error: resErr } = await supabase
			.from("reservations")
			.select("*, profiles(full_name), pool_tables(name)")
			.eq("id", reservationId)
			.single();

		if (resErr || !reservation) throw resErr ?? new Error("Reservation not found");

		if (reservation.status === 'COMPLETED') throw new Error("Reservation already completed");
		if (reservation.status === 'CANCELLED') throw new Error("Reservation cancelled");

		// 2. Calculate duration
		// If useCurrentTime is true, we start NOW, but keep the original DURATION.
		// If useCurrentTime is false, we start at start_time, effectively backdating if we are late.

		const originalStart = new Date(reservation.start_time);
		const originalEnd = new Date(reservation.end_time);
		const durationMinutes = Math.round((originalEnd.getTime() - originalStart.getTime()) / (1000 * 60));

		const openedAt = useCurrentTime ? new Date().toISOString() : reservation.start_time;

		// 3. Create Session (Fixed Time)
		// We use the customer name from profile or fallback
		const customerName = reservation.profiles?.full_name || "Reservation Guest";

		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.insert({
				pool_table_id: reservation.pool_table_id,
				status: "OPEN",
				session_type: "FIXED",
				target_duration_minutes: durationMinutes,
				is_money_game: false,
				customer_name: customerName,
				opened_at: openedAt,
				reservation_id: reservation.id,
				location_name: (reservation as any).pool_tables?.name,
			})
			.select("id")
			.single();

		if (sessionErr || !session) throw sessionErr ?? new Error("Failed to create session");

		// 4. Create Order
		await supabase.from("orders").insert({
			table_session_id: session.id,
			status: "OPEN",
		});

		// 5. Update Reservation Status
		await supabase
			.from("reservations")
			.update({ status: 'COMPLETED' })
			.eq("id", reservationId);

		revalidatePath("/pos");

		await logAction({
			actionType: "CHECK_IN_RESERVATION",
			entityType: "table_session",
			entityId: session.id,
			details: { reservationId, customerName },
		});

		// Return session ID to redirect
		return { success: true, sessionId: session.id };

	} catch (error) {
		console.error("checkInReservation failed", error);
		return { success: false, message: "Failed to check in" };
	}
}

export async function getDashboardSnapshot() {
	const supabase = createSupabaseServerClient();

	// 1. Fetch Tables
	const { data: tables } = await supabase
		.from("pool_tables")
		.select("*")
		.eq("is_active", true)
		.is("deleted_at", null)
		.order("name");

	// 2. Fetch Active Sessions
	const { data: sessions } = await supabase
		.from("table_sessions")
		.select("*")
		.eq("status", "OPEN");

	// 3. Calculate Totals for each session
	// We need to fetch items for these sessions
	const sessionTotals: { sessionId: string; itemsTotal: number }[] = [];

	if (sessions && sessions.length > 0) {
		const sessionIds = sessions.map(s => s.id);
		const { data: orderItems } = await supabase
			.from("order_items")
			.select("order_id, line_total, orders!inner(table_session_id)")
			.in("orders.table_session_id", sessionIds)
			.in("orders.status", ["OPEN", "PREPARING", "READY", "SERVED"]);

		// Map items to sessions
		if (orderItems) {
			const map = new Map<string, number>();
			orderItems.forEach(item => {
				// @ts-ignore - Supabase types join handling can be tricky to type perfectly here
				const sId = item.orders.table_session_id;
				const current = map.get(sId) || 0;
				map.set(sId, current + (item.line_total || 0));
			});
			map.forEach((total, sessionId) => {
				sessionTotals.push({ sessionId, itemsTotal: total });
			});
		}
	}

	return {
		tables: tables || [],
		sessions: sessions || [],
		sessionTotals
	};
}

export async function sendOrderToKitchen(sessionId: string) {
	const supabase = createSupabaseServerClient();

	// Get the active order for this session directly
	const { data: order } = await supabase
		.from("orders")
		.select("id, status, last_submitted_item_count, order_items(id)")
		.eq("table_session_id", sessionId)
		.in("status", ["OPEN", "PREPARING", "READY", "SERVED"])
		.order("created_at", { ascending: false })
		.limit(1)
		.single();



	if (!order) {
		return { success: false, error: "No active order found" };
	}

	// items is array of objects { id: ... } - we need quantity!
	// We need to fetch quantity to sum it up.
	// Re-fetch items with quantity.
	const { data: items } = await supabase
		.from("order_items")
		.select("quantity")
		.eq("order_id", order.id);

	const currentItemCount = items?.reduce((sum, item) => sum + (item.quantity || 1), 0) || 0;

	const { error } = await supabase
		.from("orders")
		.update({
			status: "SUBMITTED",
			last_submitted_item_count: currentItemCount,
			sent_at: new Date().toISOString()
		})
		.eq("id", order.id);

	if (error) {
		console.error("[sendOrderToKitchen] Update failed:", error);
		return { success: false, error: error.message };
	}



	revalidatePath("/kitchen"); // Ensure kitchen updates
	return { success: true };
}

export async function markOrderServedAction(orderId: string) {
	const supabase = createSupabaseServerClient();

	// 1. Get all items for this order
	const { data: items, error: fetchError } = await supabase
		.from("order_items")
		.select("id, quantity")
		.eq("order_id", orderId);

	if (fetchError) throw fetchError;

	// 2. Update served_quantity = quantity for each item
	if (items && items.length > 0) {
		const updates = items.map(item =>
			supabase
				.from("order_items")
				.update({ served_quantity: item.quantity })
				.eq("id", item.id)
		);
		await Promise.all(updates);
	}

	// 3. Update Order Status
	const { error: updateError } = await supabase
		.from("orders")
		.update({ status: "SERVED" })
		.eq("id", orderId);

	if (updateError) throw updateError;

	revalidatePath("/kitchen");
	revalidatePath("/pos");
}
