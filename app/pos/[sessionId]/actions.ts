'use server'

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

	// Load session, table rate, and open order
	const [{ data: session }, { data: order }] = await Promise.all([
		supabase.from("table_sessions").select("id, opened_at, closed_at, override_hourly_rate, pool_table_id").eq("id", sessionId).single(),
		supabase.from("orders").select("id, subtotal, tax_total, service_charge, discount_amount, total").eq("table_session_id", sessionId).eq("status", "OPEN").maybeSingle(),
	]);

	// Fetch table hourly rate
	const { data: tbl, error: tblErr } = await supabase.from("pool_tables").select("hourly_rate").eq("id", session?.pool_table_id).single();
	if (tblErr) throw tblErr;
	if (!session || !order) throw new Error("Session or order not found");

	// Close session (set closed_at)
	const closedAt = new Date();
	const { error: closeErr } = await supabase.from("table_sessions").update({ status: "CLOSED", closed_at: closedAt.toISOString() }).eq("id", sessionId);
	if (closeErr) throw closeErr;

	// Compute duration as integer minutes to satisfy INT quantity
	const openedAt = new Date(session.opened_at as string);
	const durationMs = Math.max(0, closedAt.getTime() - openedAt.getTime());
	const qty = Math.max(0, Math.ceil(durationMs / (1000 * 60))); // integer minutes, rounded up
	const hourlyRate = Number(session.override_hourly_rate ?? tbl.hourly_rate);

	// Ensure table time product exists
	const { data: tableTimeProduct, error: ttpErr } = await supabase
		.from("products")
		.select("id, category")
		.eq("sku", "TABLE_TIME")
		.maybeSingle();
	if (ttpErr || !tableTimeProduct) throw new Error("TABLE_TIME product not found. Please run seed migration.");

	// Upsert TABLE_TIME line (replace any existing)
	// Unit price is per minute
	const perMinuteRate = Number((hourlyRate / 60).toFixed(2));
	const lineTotal = Number((qty * perMinuteRate).toFixed(2));
	const { data: existingLine } = await supabase
		.from("order_items")
		.select("id")
		.eq("order_id", order.id)
		.eq("product_id", tableTimeProduct.id)
		.maybeSingle();
	if (existingLine?.id) {
		const { error: updErr } = await supabase
			.from("order_items")
			.update({ quantity: qty, unit_price: perMinuteRate, line_total: lineTotal })
			.eq("id", existingLine.id);
		if (updErr) throw updErr;
	} else {
		const { error: insErr } = await supabase.from("order_items").insert({
			order_id: order.id,
			product_id: tableTimeProduct.id,
			quantity: qty,
			unit_price: perMinuteRate,
			line_total: lineTotal,
		});
		if (insErr) throw insErr;
	}

	// Recalculate final totals (including TABLE_TIME)
	const { data: allItems, error: itemsErr } = await supabase
		.from("order_items")
		// We include product category here so we can drive inventory movements off the same data.
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
	// We convert products into inventory_items via the recipe table so this works with
	// both simple 1:1 mappings and more complex recipes later.
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

			// Build a lookup from product -> its recipe components.
			const recipeByProduct = new Map<string, Array<{ inventory_item_id: string; quantity: number }>>();
			for (const r of recipes ?? []) {
				const pid = r.product_id as string;
				const qty = Number(r.quantity ?? 0);
				if (!pid || !Number.isFinite(qty) || qty <= 0) continue;
				const list = recipeByProduct.get(pid) ?? [];
				list.push({ inventory_item_id: r.inventory_item_id as string, quantity: qty });
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
				const qty = Number(row.quantity ?? 0);
				if (!pid || !Number.isFinite(qty) || qty === 0) continue;
				const safeQty = Math.abs(Math.trunc(qty));
				if (safeQty === 0) continue;
				const components = recipeByProduct.get(pid);
				if (!components || components.length === 0) {
					// If there is no recipe we skip inventory tracking for this product.
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
						// Sales always move stock out, so we store a negative quantity.
						quantity: -Math.trunc(totalOut),
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
	// This keeps revenue reporting based on what was actually earned.
	const appliedAmount = finalTotal;

	// Insert payment (form already validated tenderedAmount > 0).
	// We store both the applied amount and what the guest tendered.
	const { error: payErr } = await supabase
		.from("payments")
		.insert({
			order_id: order.id,
			amount: appliedAmount,
			tendered_amount: tenderedAmount,
			method,
		});
	if (payErr) throw payErr;

	// Mark order paid
	const { error: orderUpdErr } = await supabase.from("orders").update({ status: "PAID", subtotal, tax_total: taxTotal, total: finalTotal }).eq("id", order.id);
	if (orderUpdErr) throw orderUpdErr;

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

	// Do not allow zero or negative payments
	if (!Number.isFinite(tenderedAmount) || tenderedAmount <= 0) {
		redirect(`/pos/${sessionId}?error=amount`);
	}

	await payOrderAction(sessionId, method, tenderedAmount);
}


