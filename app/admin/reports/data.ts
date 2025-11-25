import { createSupabaseServerClient } from "@/lib/supabase/server";

// Lightweight types for the raw data returned from Supabase.
// We keep them broad (any[]) so the sections can shape them as needed
// without this file becoming a bottleneck for iteration.

export interface ReportData {
	total: number | null;
	byCategory: any[] | null;
	byMethod: any[] | null;
	tx: any[] | null;
	daily: any[] | null;
	byTable: any[] | null;
	byShift: any[] | null;
	drinkMargins: any[] | null;
	categoryMargins: any[] | null;
	expenses: any[] | null;
	monthly: any[] | null;
}

/**
 * Fetches all the raw data the reports views need for a given date range.
 *
 * We:
 * - Reuse the existing SQL helpers (total_revenue, revenue_by_category, etc.)
 * - Return simple arrays so UI sections stay easy to reason about
 * - Keep this as the single source of truth for reporting queries
 */
export async function getReportData(start: string, end: string): Promise<ReportData> {
	const supabase = createSupabaseServerClient();

	// Compute end-exclusive date for range filtering (end + 1 day).
	const endDate = new Date(end);
	endDate.setDate(endDate.getDate() + 1);
	const endExclusive = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(
		endDate.getDate(),
	).padStart(2, "0")}`;

	const [
		{ data: total },
		{ data: byCategory },
		{ data: byMethod },
		{ data: tx },
		{ data: daily },
		{ data: byTable },
		{ data: byShift },
		{ data: drinkMargins },
		{ data: categoryMargins },
		{ data: expenses },
		{ data: monthly },
	] = await Promise.all([
		supabase.rpc("total_revenue", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_category", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_method", { p_start: start, p_end: end }),
		supabase
			.from("payments")
			.select(
				"id, amount, method, paid_at, orders:order_id(id, total, table_sessions:table_session_id(id, pool_tables:pool_table_id(name)))",
			)
			.gte("paid_at", start)
			.lt("paid_at", endExclusive)
			.order("paid_at", { ascending: false }),
		supabase.rpc("daily_revenue", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_table", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_shift", { p_start: start, p_end: end }),
		supabase.rpc("margin_by_drink_type", { p_start: start, p_end: end }),
		supabase.rpc("margin_by_category", { p_start: start, p_end: end }),
		supabase.rpc("get_expenses", { p_start: start, p_end: end }),
		supabase.rpc("monthly_financial_summary", { p_start: start, p_end: end }),
	]);

	return {
		total: total as number | null,
		byCategory: (byCategory as any[] | null) ?? [],
		byMethod: (byMethod as any[] | null) ?? [],
		tx: (tx as any[] | null) ?? [],
		daily: (daily as any[] | null) ?? [],
		byTable: (byTable as any[] | null) ?? [],
		byShift: (byShift as any[] | null) ?? [],
		drinkMargins: (drinkMargins as any[] | null) ?? [],
		categoryMargins: (categoryMargins as any[] | null) ?? [],
		expenses: (expenses as any[] | null) ?? [],
		monthly: (monthly as any[] | null) ?? [],
	};
}




