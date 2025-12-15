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
	topCustomers: any[] | null;
	walletLiability: number | null;
	financials: {
		sales: number;
		totalExpenses: number;
		cashCollected: number;
		walletUsage: number;
		netProfit: number;
		cashFlow: number;
		breakdown: {
			cash: number;
			gcash: number;
			other: number;
			deposits: number;
		};
		categories: {
			pool: number;
			food: number;
			drinks: number;
			other: number;
		}
	} | null;
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
		{ data: txPayments },
		{ data: txDeposits },
		{ data: daily },
		{ data: byTable },
		{ data: byShift },
		{ data: drinkMargins },
		{ data: categoryMargins },
		{ data: expenses },
		{ data: monthly },
		{ data: topCustomers },
		{ data: walletLiability },
	] = await Promise.all([
		supabase.rpc("total_revenue", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_category", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_method", { p_start: start, p_end: end }),
		// 1. Fetch Sales (Payments)
		supabase
			.from("payments")
			.select(
				"id, amount, method, paid_at, orders:order_id(id, total, table_sessions:table_session_id(id, customer_name, pool_tables:pool_table_id(name)), reservations(pool_tables:pool_table_id(name)), profiles:profile_id(full_name))",
			)
			.gte("paid_at", start)
			.lt("paid_at", endExclusive)
			.order("paid_at", { ascending: false }),
		// 2. Fetch Wallet Deposits
		supabase
			.from("wallet_transactions")
			.select(
				"id, amount, created_at, wallet:wallet_id(profiles(full_name))",
			)
			.eq("type", "DEPOSIT")
			.gte("created_at", start)
			.lt("created_at", endExclusive)
			.order("created_at", { ascending: false }),
		supabase.rpc("daily_revenue", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_table", { p_start: start, p_end: end }),
		supabase.rpc("revenue_by_shift", { p_start: start, p_end: end }),
		supabase.rpc("margin_by_drink_type", { p_start: start, p_end: end }),
		supabase.rpc("margin_by_category", { p_start: start, p_end: end }),
		supabase.rpc("get_expenses", { p_start: start, p_end: end }),
		supabase.rpc("monthly_financial_summary", { p_start: start, p_end: end }),
		supabase.rpc("get_top_customers", { p_start: start, p_end: end }),
		supabase.rpc("get_wallet_liability"),
	]);

	// Merge and sort transactions
	const payments = (txPayments as any[]) ?? [];
	const deposits = (txDeposits as any[]) ?? [];

	const combinedTx = [
		...payments,
		...deposits.map((d) => ({
			id: d.id,
			amount: d.amount,
			method: "WALLET_TOPUP",
			paid_at: d.created_at,
			// Mock the nested structure expected by OperationsSection
			orders: {
				id: "TOPUP",
				total: d.amount,
				table_sessions: {
					id: "WALLET",
					pool_tables: {
						name: d.wallet?.profiles?.full_name
							? `Top-up: ${d.wallet.profiles.full_name}`
							: "Wallet Top-up",
					},
				},
			},
		})),
	].sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

	// Calculate Financials
	const salesRevenue = Number(total ?? 0);
	const totalExpenses = (expenses as any[] ?? []).reduce((sum, e) => sum + Number(e.amount), 0);

	const walletUsage = payments
		.filter((p: any) => p.method === 'WALLET')
		.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

	const cashSales = payments
		.filter((p: any) => p.method === 'CASH')
		.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

	const gcashSales = payments
		.filter((p: any) => p.method === 'GCASH')
		.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

	// Any other method (CARD, etc)
	const otherSales = payments
		.filter((p: any) => !['WALLET', 'CASH', 'GCASH'].includes(p.method))
		.reduce((sum: number, p: any) => sum + Number(p.amount), 0);

	const walletDeposits = deposits
		.reduce((sum: number, d: any) => sum + Number(d.amount), 0);

	const cashCollected = (salesRevenue - walletUsage) + walletDeposits;
	const netProfit = salesRevenue - totalExpenses;
	const cashFlow = cashCollected - totalExpenses;

	// Calculate Category Breakdown
	const catMap = new Map((byCategory ?? []).map((c: any) => [c.category, Number(c.revenue)]));
	const poolSales = catMap.get('TABLE_TIME') ?? 0;
	const foodSales = catMap.get('FOOD') ?? 0;
	const drinkSales = catMap.get('DRINK') ?? 0;
	// Calculate 'other' by subtracting known categories from total, or summing unknown categories
	// To be safe, let's sum remaining categories
	const otherCategorySales = (byCategory ?? [])
		.filter((c: any) => !['TABLE_TIME', 'FOOD', 'DRINK'].includes(c.category))
		.reduce((sum: number, c: any) => sum + Number(c.revenue), 0);


	return {
		total: total as number | null,
		byCategory: (byCategory as any[] | null) ?? [],
		byMethod: (byMethod as any[] | null) ?? [],
		tx: combinedTx,
		daily: (daily as any[] | null) ?? [],
		byTable: (byTable as any[] | null) ?? [],
		byShift: (byShift as any[] | null) ?? [],
		drinkMargins: (drinkMargins as any[] | null) ?? [],
		categoryMargins: (categoryMargins as any[] | null) ?? [],
		expenses: (expenses as any[] | null) ?? [],
		monthly: (monthly as any[] | null) ?? [],
		topCustomers: (topCustomers as any[] | null) ?? [],
		walletLiability: (walletLiability as number | null),
		financials: {
			sales: salesRevenue,
			totalExpenses,
			cashCollected,
			walletUsage,
			netProfit,
			cashFlow,
			breakdown: {
				cash: cashSales,
				gcash: gcashSales,
				other: otherSales,
				deposits: walletDeposits
			},
			categories: {
				pool: poolSales,
				food: foodSales,
				drinks: drinkSales,
				other: otherCategorySales
			}
		}
	};
}
