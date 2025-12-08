'use server'

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { closeSessionAndRecordPayment } from "@/lib/payments/closeSession";
import { logAction } from "@/lib/logger";

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

	// Revalidate session view; page will fetch fresh data
	revalidatePath(`/pos/${line.order_id}`);
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
) {
	const supabase = createSupabaseServerClient();
	await closeSessionAndRecordPayment(supabase, { sessionId, method, tenderedAmount });

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

	await payOrderAction(sessionId, method, tenderedAmount);
}


