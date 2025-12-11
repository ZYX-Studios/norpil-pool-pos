export const dynamic = 'force-dynamic';
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { openTableAction } from "./actions";
import { ClientTimer } from "./ClientTimer";
import { PosHomeClient } from "./PosHomeClient";

type PoolTable = {
	id: string;
	name: string;
	is_active: boolean;
	hourly_rate: number;
};

type OpenSession = {
	id: string;
	pool_table_id: string;
	opened_at: string;
	override_hourly_rate: number | null;
	customer_name?: string | null;
	session_type: "OPEN" | "FIXED";
	target_duration_minutes?: number | null;
	is_money_game: boolean;
	bet_amount?: number | null;
};

async function getData() {
	const supabase = createSupabaseServerClient();

	try {
		const [{ data: tables, error: tablesErr }, { data: sessions, error: sessionsErr }] = await Promise.all([
			supabase.from("pool_tables").select("id, name, is_active, hourly_rate").is("deleted_at", null).eq("is_active", true).order("name", { ascending: true }),
			supabase
				.from("table_sessions")
				.select("id, pool_table_id, opened_at, override_hourly_rate, customer_name, session_type, target_duration_minutes, is_money_game, bet_amount")
				.eq("status", "OPEN"),
		]);

		if (tablesErr) throw tablesErr;
		if (sessionsErr) throw sessionsErr;

		// Fetch open orders for sessions to compute current items total
		const sessionIds = (sessions ?? []).map((s) => s.id);
		const { data: orders, error: ordersErr } =
			sessionIds.length > 0
				? await supabase
					.from("orders")
					.select("id, table_session_id, subtotal, tax_total, service_charge, discount_amount")
					.in("table_session_id", sessionIds)
					.in("status", ["OPEN", "PREPARING", "READY", "SERVED"])
				: { data: [] as any[], error: null as any };

		if (ordersErr) throw ordersErr;

		const sessionIdToOrderTotal = new Map<string, number>();
		for (const o of orders ?? []) {
			const totalNow =
				Number(o.subtotal || 0) +
				Number(o.tax_total || 0) +
				Number(o.service_charge || 0) -
				Number(o.discount_amount || 0);
			sessionIdToOrderTotal.set(o.table_session_id as string, Number(totalNow.toFixed(2)));
		}

		// Fetch today's reservations
		const startOfDay = new Date();
		startOfDay.setHours(0, 0, 0, 0);
		const endOfDay = new Date();
		endOfDay.setHours(23, 59, 59, 999);

		const { data: reservations } = await supabase
			.from("reservations")
			.select("*")
			.in("status", ["CONFIRMED"]) // Filter only by valid statuses
			.gte("start_time", startOfDay.toISOString())
			.lte("start_time", endOfDay.toISOString())
			.order("start_time");

		// We keep this structure small and serialisable so it can be safely
		// passed into the client component that handles offline snapshots.
		return {
			tables: (tables ?? []) as PoolTable[],
			openSessions: (sessions ?? []) as OpenSession[],
			reservations: (reservations ?? []) as any[],
			sessionIdToOrderTotal,
			errorCode: null as string | null,
		};
	} catch (error) {
		// When Supabase is unreachable (e.g. device offline), we still render the
		// POS shell and let the client component fall back to a cached snapshot.
		// Network failures are normal in that scenario, so we only log unexpected
		// errors to keep the console clean during offline use.
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
			console.error("Failed to load POS tables data", error);
		}
		return {
			tables: [] as PoolTable[],
			openSessions: [] as OpenSession[],
			reservations: [] as any[],
			sessionIdToOrderTotal: new Map<string, number>(),
			errorCode: "load_failed" as string | null,
		};
	}
}

export default async function PosHome({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[]>>;
}) {
	const sp = await searchParams;
	const queryError = (sp?.error as string | undefined) ?? null;
	const { tables, openSessions, reservations, sessionIdToOrderTotal, errorCode } = await getData();

	// Prepare a serialisable representation of session totals for the client.
	const sessionTotalsArray = Array.from(sessionIdToOrderTotal.entries()).map(
		([sessionId, itemsTotal]) => ({
			sessionId,
			itemsTotal,
		}),
	);

	// Delegate the actual rendering and offline snapshot logic to the client component.
	// This keeps the server page focused on data fetching and makes it easier to evolve
	// offline behaviour without touching server code.
	return (
		<PosHomeClient
			initialTables={tables}
			initialSessions={openSessions}
			initialReservations={reservations}
			initialSessionTotals={sessionTotalsArray}
			initialErrorCode={errorCode ?? queryError}
		/>
	);
}

// Forced rebuild comment
