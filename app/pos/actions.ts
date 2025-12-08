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
};

export async function openTableAction(data: OpenTableData) {
	const supabase = createSupabaseServerClient();
	const { poolTableId, sessionType, targetDurationMinutes, isMoneyGame, betAmount, customerName } = data;

	try {
		// Find an existing OPEN session for this table (idempotency safeguard)
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

export async function createWalkInSession(customerName: string) {
	const supabase = createSupabaseServerClient();

	try {
		// Create session with no table (pool_table_id is null)
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.insert({
				pool_table_id: null,
				customer_name: customerName,
				status: "OPEN",
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

export async function updateSessionCustomerName(sessionId: string, name: string) {
	const supabase = createSupabaseServerClient();

	try {
		const { error } = await supabase
			.from("table_sessions")
			.update({ customer_name: name })
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
				pool_table:pool_tables(hourly_rate),
				orders(id)
			`)
			.eq("id", sessionId)
			.single();

		if (sessionErr || !session) {
			throw sessionErr ?? new Error("Session not found");
		}

		// 2. Calculate final table fee
		const now = Date.now();
		const openedAt = new Date(session.opened_at).getTime();
		const accumulated = (session.accumulated_paused_time || 0) * 1000;
		let elapsedMs = 0;

		if (session.paused_at) {
			const pauseStart = new Date(session.paused_at).getTime();
			elapsedMs = Math.max(0, pauseStart - openedAt - accumulated);
		} else {
			elapsedMs = Math.max(0, now - openedAt - accumulated);
		}

		const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
		const hourlyRate = session.pool_table?.hourly_rate ?? 0;
		let tableFee = 0;

		if (session.session_type === 'FIXED' && session.target_duration_minutes) {
			// Fixed Time Logic
			const baseFee = (session.target_duration_minutes / 60) * hourlyRate;
			const excessMinutes = Math.max(0, elapsedMinutes - session.target_duration_minutes);
			const excessFee = excessMinutes * (hourlyRate / 60);
			tableFee = baseFee + excessFee;
		} else {
			// Open Time Logic (Default)
			// "exceeds 5 mins... add every 30 mins"
			if (elapsedMinutes > 5) {
				const blocks = Math.ceil(elapsedMinutes / 30);
				tableFee = blocks * 0.5 * hourlyRate;
			}
		}

		// Money Game Logic
		if (session.is_money_game && session.bet_amount) {
			const minimumFee = session.bet_amount * 0.10;
			tableFee = Math.max(tableFee, minimumFee);
		}

		tableFee = Number(tableFee.toFixed(2));

		// 3. Add "Table Time" as a fixed order item if there's a fee
		console.log(`[releaseTable] Fee calc: elapsed=${elapsedMinutes}m, type=${session.session_type}, fee=${tableFee}`);

		if (tableFee > 0 && session.orders?.[0]?.id) {
			const orderId = session.orders[0].id;

			// Check if Table Time item already exists (unlikely but safe)
			// We can't filter by category on order_items, so we rely on product join if needed, 
			// or just check if we already added it. 
			// Since we are releasing, we assume we haven't added it yet.
			// But to be safe, let's check if there's an item with the Table Time product ID.
			// We need the product ID first.
			// The original `existingItem` check was removed as it was not specific enough.

			// Let's look for a "Table Time" product.
			const { data: timeProduct } = await supabase
				.from("products")
				.select("id")
				.eq("name", "Table Time")
				.maybeSingle();

			let timeProductId = timeProduct?.id;

			if (!timeProductId) {
				// Fallback: Create a system product for Table Time if missing
				const { data: newProduct } = await supabase
					.from("products")
					.insert({
						name: "Table Time",
						category: "TABLE_TIME",
						price: 0,
						is_active: true // Fixed column name
					})
					.select("id")
					.single();
				timeProductId = newProduct?.id;
			}

			if (timeProductId) {
				// Check if we already added this product to this order
				const { data: existingTimeItem } = await supabase
					.from("order_items")
					.select("id")
					.eq("order_id", orderId)
					.eq("product_id", timeProductId)
					.maybeSingle();

				if (!existingTimeItem) {
					const { error: insertErr } = await supabase.from("order_items").insert({
						order_id: orderId,
						product_id: timeProductId,
						quantity: 1,
						unit_price: tableFee,
						line_total: tableFee
						// Removed 'category' field as it doesn't exist on order_items
					});
					if (insertErr) {
						console.error("[releaseTable] Failed to insert table time item:", insertErr);
						// We don't throw here to allow the release to proceed, 
						// but ideally this should work.
					}
				}
			}
		} else {
			console.log("[releaseTable] Skipping table time item. Fee:", tableFee, "Order:", session.orders?.[0]?.id);
		}

		// 4. Update session: release table, set customer name, and PAUSE the timer permanently (or effectively stop it)
		// We set paused_at to NOW if it wasn't paused, so the time stops counting.
		// Actually, since we are converting to walk-in, the `pool_table_id` becomes null.
		// The `ClientTimer` logic checks `pausedAt`. If we set `pausedAt`, it shows "Paused".
		// But for a released table, we want it to just show the final time or nothing?
		// The user said "release should stop the timers".
		// If we set `paused_at`, it stops.

		const updates: any = {
			pool_table_id: null,
			// If not already paused, pause it now to "stop" the timer.
			paused_at: session.paused_at || new Date().toISOString()
		};

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


