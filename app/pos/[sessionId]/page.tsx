export const dynamic = 'force-dynamic';
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SessionClient } from "./SessionClient";
import { SessionOfflineFallback } from "./SessionOfflineFallback";

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

	// If the session ID looks like a local-only ID (created while offline),
	// we skip the server query entirely to avoid Postgres "invalid uuid" errors.
	// Instead, we immediately render the offline fallback which loads the
	// session from IndexedDB.
	if (sessionId.startsWith("session_")) {
		return <SessionOfflineFallback sessionId={sessionId} />;
	}

	try {
		// Load session + table
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.select("id, opened_at, override_hourly_rate, customer_name, paused_at, accumulated_paused_time, session_type, target_duration_minutes, is_money_game, bet_amount, reservation_id, reservations(payment_status), pool_tables:pool_table_id(id, name, hourly_rate)")
			.eq("id", sessionId)
			.maybeSingle();
		if (sessionErr) {
			throw sessionErr;
		}

		if (!session) {
			return notFound();
		}

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
			<>
				<SessionClient
					sessionId={sessionId}
					tableName={(session as any).pool_tables?.name ?? (session as any).customer_name ?? "Walk-in"}
					customerName={(session as any).customer_name}
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
	} catch (error) {
		// When the device is offline or Supabase is unreachable, we render a
		// client-side fallback that attempts to load a cached snapshot of the
		// session from this device instead of showing a hard 404.
		// Network / connectivity failures are expected in this path. For those
		// we silently fall back to the offline snapshot without logging an
		// error, and only log unexpected problems.
		let message: string;
		if (error instanceof Error && error.message) {
			message = error.message;
		} else if (error && typeof error === "object" && "message" in error && typeof (error as any).message === "string") {
			message = (error as any).message as string;
		} else {
			message = String(error);
		}
		const lower = message.toLowerCase();
		const isNetworkError = lower.includes("failed to fetch") || lower.includes("fetch failed");
		if (!isNetworkError) {
			console.error("Failed to load POS session page", error);
		}
		return <SessionOfflineFallback sessionId={sessionId} />;
	}
}
