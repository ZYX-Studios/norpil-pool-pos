export const dynamic = 'force-dynamic';
import { notFound } from "next/navigation";
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
			.select("id, opened_at, override_hourly_rate, pool_tables:pool_table_id(id, name, hourly_rate)")
			.eq("id", sessionId)
			.maybeSingle();
		if (sessionErr) {
			throw sessionErr;
		}
		if (!session) return notFound();

		// Load open order
		const { data: order, error: orderErr } = await supabase
			.from("orders")
			.select("id")
			.eq("table_session_id", sessionId)
			.eq("status", "OPEN")
			.maybeSingle();
		if (orderErr) {
			throw orderErr;
		}
		if (!order) return notFound();

		// Load items with product info (including tax_rate for totals).
		const { data: items, error: itemsErr } = await supabase
			.from("order_items")
			.select("id, product_id, quantity, unit_price, line_total, products(name, category, tax_rate)")
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

		const hourlyRate = Number(
			session.override_hourly_rate ?? (session as any).pool_tables?.hourly_rate ?? 0,
		);

		return (
			<SessionClient
				sessionId={sessionId}
				tableName={(session as any).pool_tables?.name ?? "Table"}
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
			/>
		);
	} catch (error) {
		// When the device is offline or Supabase is unreachable, we show a friendly
		// message instead of a 404 "Page not found" so staff understand what happened.
		console.error("Failed to load POS session page", error);

		return (
			<div className="mx-auto max-w-3xl space-y-3 p-4 text-sm text-neutral-100">
				<h1 className="text-lg font-semibold text-neutral-50">Session unavailable</h1>
				<p className="text-xs text-neutral-300">
					This table session could not be loaded. You might be offline or the server is unreachable.
					Please check your connection and try again.
				</p>
			</div>
		);
	}
}
