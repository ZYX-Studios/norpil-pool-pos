'use server'

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { closeSessionAndRecordPayment } from "@/lib/payments/closeSession";
import { logAction } from "@/lib/logger";

async function getSessionIdForOrderId(supabase: SupabaseClient, orderId: string): Promise<string | null> {
	const { data, error } = await supabase
		.from("orders")
		.select("table_session_id")
		.eq("id", orderId)
		.maybeSingle();
	if (error) return null;
	return (data?.table_session_id as string) ?? null;
}

async function revalidatePosForOrderId(supabase: SupabaseClient, orderId: string) {
	// Always revalidate home list so it refreshes after mutations/pay/void.
	revalidatePath("/pos");
	const sessionId = await getSessionIdForOrderId(supabase, orderId);
	if (sessionId) revalidatePath(`/pos/${sessionId}`);
}

export async function addItemAction(orderId: string, productId: string) {
	const supabase = createSupabaseServerClient();

	// Get product price and tax rate
	const { data: product, error: prodErr } = await supabase
		.from("products")
		.select("id, price, tax_rate, category")
		.eq("id", productId)
		.maybeSingle();
	if (prodErr || !product) throw prodErr ?? new Error("Product not found");

	// Check if line exists
	const { data: existing } = await supabase
		.from("order_items")
		.select("id, quantity, unit_price")
		.eq("order_id", orderId)
		.eq("product_id", productId)
		.limit(1)
		.maybeSingle();

	if (existing?.id) {
		const newQty = (existing.quantity as number) + 1;
		const lineTotal = Number((newQty * Number(existing.unit_price)).toFixed(2));
		const { error: updErr } = await supabase
			.from("order_items")
			.update({ quantity: newQty, line_total: lineTotal })
			.eq("id", existing.id);
		if (updErr) throw updErr;
	} else {
		const unitPrice = Number(product.price);
		const lineTotal = Number((unitPrice * 1).toFixed(2));
		const { error: insErr } = await supabase.from("order_items").insert({
			order_id: orderId,
			product_id: productId,
			quantity: 1,
			unit_price: unitPrice,
			line_total: lineTotal,
		});
		if (insErr) throw insErr;
	}

	await recalcOrderTotals(orderId);

	await logAction({
		actionType: "ADD_ITEM",
		entityType: "order",
		entityId: orderId,
		details: { productId },
	});

	revalidatePath(`/pos`);
}

export async function updateItemQuantityAction(orderItemId: string, quantity: number) {
	const supabase = createSupabaseServerClient();

	// Fetch line to compute new total
	const { data: line, error: lineErr } = await supabase
		.from("order_items")
		.select("id, order_id, unit_price")
		.eq("id", orderItemId)
		.single();
	if (lineErr) throw lineErr;

	if (quantity <= 0) {
		const { error: delErr } = await supabase.from("order_items").delete().eq("id", orderItemId);
		if (delErr) throw delErr;
	} else {
		const newTotal = Number((Number(line.unit_price) * quantity).toFixed(2));
		const { error: updErr } = await supabase
			.from("order_items")
			.update({ quantity, line_total: newTotal })
			.eq("id", orderItemId);
		if (updErr) throw updErr;
	}

	await recalcOrderTotals(line.order_id as string);

	await logAction({
		actionType: "UPDATE_ITEM_QUANTITY",
		entityType: "order_item",
		entityId: orderItemId,
		details: { quantity },
	});

	// Revalidate home + session view; page will fetch fresh data
	await revalidatePosForOrderId(supabase, line.order_id as string);
}

async function recalcOrderTotals(orderId: string) {
	const supabase = createSupabaseServerClient();
	// Sum non-table-time items
	const { data: items, error: itemsErr } = await supabase
		.from("order_items")
		.select("quantity, unit_price, line_total, products(category, tax_rate)")
		.eq("order_id", orderId);
	if (itemsErr) throw itemsErr;

	let subtotal = 0;
	let taxTotal = 0;
	for (const row of items ?? []) {
		const isTableTime = (row as any).products?.category === "TABLE_TIME";
		if (isTableTime) continue; // exclude while OPEN
		const line = Number((row as any).line_total ?? 0);
		const taxRate = Number((row as any).products?.tax_rate ?? 0);
		subtotal += line;
		taxTotal += Number((line * taxRate).toFixed(2));
	}
	const total = Number((subtotal + taxTotal).toFixed(2));
	const { error: updErr } = await supabase
		.from("orders")
		.update({ subtotal: Number(subtotal.toFixed(2)), tax_total: Number(taxTotal.toFixed(2)), total })
		.eq("id", orderId);
	if (updErr) throw updErr;
}

// Handle final payment for a table session.
// We intentionally separate "tendered" (what the guest paid) from "amount"
// (what we apply as revenue for this order). This keeps reports correct.
export async function payOrderAction(
	sessionId: string,
	method: "CASH" | "GCASH" | "CARD" | "OTHER",
	tenderedAmount: number,
	options?: { profileId?: string; idempotencyKey?: string },
) {
	const supabase = createSupabaseServerClient();
	await closeSessionAndRecordPayment(supabase, {
		sessionId,
		method,
		tenderedAmount,
		profileId: options?.profileId,
		idempotencyKey: options?.idempotencyKey,
	});

	await logAction({
		actionType: "PAY_ORDER",
		entityType: "table_session",
		entityId: sessionId,
		details: { method, tenderedAmount },
	});

	revalidatePath("/pos");
	redirect("/pos");
}

export async function payOrderFormAction(formData: FormData) {
	const sessionId = String(formData.get("sessionId") || "");
	const method = (String(formData.get("method") || "CASH") as "CASH" | "GCASH" | "CARD" | "OTHER");
	// We treat this as the tendered amount (what the guest handed over).
	// For backwards compatibility we also accept "amount" if the new field is missing.
	const tenderedRaw = formData.get("tenderedAmount") ?? formData.get("amount");
	const tenderedAmount = Number(tenderedRaw ?? "0");

	// Do not allow negative payments. We allow 0 for prepaid/comped sessions.
	if (!Number.isFinite(tenderedAmount) || tenderedAmount < 0) {
		redirect(`/pos/${sessionId}?error=amount`);
	}

	const profileId = String(formData.get("profileId") || "") || undefined;
	const idempotencyKey = String(formData.get("idempotencyKey") || "") || undefined;

	await payOrderAction(sessionId, method, tenderedAmount, { profileId, idempotencyKey });
}

// Void a committed item (full or partial).
// It logs the action and deletes/updates the row (which triggers inventory reclaim).
export async function voidOrderItemAction(orderItemId: string, reason: string, voidQuantity?: number) {
	const supabase = createSupabaseServerClient();

	// 1. Fetch item details
	const { data: item, error: fetchErr } = await supabase
		.from("order_items")
		.select("id, order_id, quantity, unit_price, product:products(name)")
		.eq("id", orderItemId)
		.single();

	if (fetchErr || !item) throw new Error("Item not found");

	const qtyToVoid = voidQuantity ?? item.quantity;

	// Validation
	if (qtyToVoid <= 0) throw new Error("Invalid void quantity");
	if (qtyToVoid > item.quantity) throw new Error("Cannot void more than current quantity");

	// 2. Perform Delete or Update
	// The DB trigger `trg_inventory_on_item_change` will handle stock reclaim if order is SUBMITTED.
	if (qtyToVoid === item.quantity) {
		// Full Void
		const { error: delErr } = await supabase
			.from("order_items")
			.delete()
			.eq("id", orderItemId);
		if (delErr) throw delErr;
	} else {
		// Partial Void
		const newQty = item.quantity - qtyToVoid;
		const newTotal = Number((newQty * Number(item.unit_price)).toFixed(2));

		const { error: updErr } = await supabase
			.from("order_items")
			.update({ quantity: newQty, line_total: newTotal })
			.eq("id", orderItemId);
		if (updErr) throw updErr;
	}

	// 3. Recalculate Totals
	await recalcOrderTotals(item.order_id as string);

	// 4. Log the Void Action
	await logAction({
		actionType: "VOID_ITEM",
		entityType: "order_item",
		entityId: orderItemId,
		details: {
			product: (item.product as any)?.name,
			quantity: qtyToVoid, // Log the amount voided
			reason
		}
	});

	await revalidatePosForOrderId(supabase, item.order_id as string);


}

// Unified action to Set Quantity for a Product
// Handles Add, Update, and Delete (if qty <= 0).
// Simpler and safer than separate Add/Update actions for UI sync.
export async function setProductQuantityAction(orderId: string, productId: string, quantity: number) {
	try {
		const supabase = createSupabaseServerClient();

		// 1. Get Product Details (Price, etc) safely
		const { data: product, error: prodErr } = await supabase
			.from("products")
			.select("id, price, tax_rate, category, name")
			.eq("id", productId)
			.single();

		if (prodErr || !product) {
			console.error("setProductQuantityAction product lookup failed:", productId, prodErr);
			throw new Error(`CRITICAL FAILURE: Product not found for ID: ${productId}`);
		}

		// 2. Find Existing Line
		const { data: existing } = await supabase
			.from("order_items")
			.select("id, quantity, unit_price, served_quantity")
			.eq("order_id", orderId)
			.eq("product_id", productId)
			.maybeSingle();

		// 3. Handle Logic
		if (quantity <= 0) {
			// DELETE
			if (existing) {
				// Check if served (Validation) - though UI should block this, server must too?
				// Actually, if we are in "Unsubmitted" phase, served_quantity is 0.
				// The VOID logic handles the submitted items.
				// If we try to "remove" a served item via this action, we should block or redirect to void?
				// But for now, let's assume this action is for "Syncing Cart State".
				// If served_quantity > 0, we can't just delete it.
				if (existing.served_quantity > 0) {
					throw new Error("Cannot remove served items via sync. Use Void.");
				}

				const { error: delErr } = await supabase.from("order_items").delete().eq("id", existing.id);
				if (delErr) throw delErr;

				await logAction({
					actionType: "UPDATE_ITEM_QUANTITY", // Using UPDATE for generic "Change"
					entityType: "order_item",
					entityId: existing.id,
					details: { productId, quantity: 0, type: "REMOVE" }
				});
			}
		} else {
			// UPSERT
			const unitPrice = existing ? existing.unit_price : product.price;
			const lineTotal = Number((quantity * Number(unitPrice)).toFixed(2));

			if (existing) {
				// UPDATE
				const { error: updErr } = await supabase
					.from("order_items")
					.update({ quantity, line_total: lineTotal })
					.eq("id", existing.id);
				if (updErr) throw updErr;
			} else {
				// INSERT
				const { error: insErr } = await supabase
					.from("order_items")
					.insert({
						order_id: orderId,
						product_id: productId,
						quantity,
						unit_price: unitPrice,
						line_total: lineTotal
					});
				if (insErr) throw insErr;

				await logAction({
					actionType: "ADD_ITEM",
					entityType: "order",
					entityId: orderId,
					details: { productId, quantity, name: product.name }
				});
			}
		}

		// 4. Recalculate Totals
		await recalcOrderTotals(orderId);

		// 5. Revalidate
		// Enable revalidate to ensure UI and Server stay in sync, preventing double-submissions
		await revalidatePosForOrderId(supabase, orderId);
	} catch (error) {
		console.error("setProductQuantityAction Error:", error);
		// Try to log the failure
		try {
			await logAction({
				actionType: "FIX_STOCK_ERROR", // Using a known type or generic
				entityType: "order",
				entityId: orderId,
				details: { error: error instanceof Error ? error.message : String(error), productId, quantity }
			});
		} catch (e) { console.error("Failed to log error", e); }
		throw error;
	}
}
