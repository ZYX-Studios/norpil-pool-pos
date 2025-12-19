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
	previousTotal?: number;
	trendPct?: number;
	hourly?: any[] | null;
}

// ... getReportData function ...

async function fetchTransactionsWithDetails(supabase: any, start: string, end: string) {
	// Handle Date Range in Manila Time (UTC+8) to match RPCs used in other reports.
	// We need to construct absolute UTC timestamps that represent the start (00:00) and end (23:59:59)
	// of the Manila days passed in `start` and `end`.

	// `start` and `end` are YYYY-MM-DD strings.
	// Manila is UTC+8. 
	// Start of Day: YYYY-MM-DD 00:00:00 Manila = YYYY-MM-DD -1 day 16:00:00 UTC
	// End of Day:   YYYY-MM-DD 23:59:59 Manila = YYYY-MM-DD 15:59:59 UTC

	const utcStart = new Date(start);
	utcStart.setHours(utcStart.getHours() - 8); // 00:00 - 8h = 16:00 prev day
	const startIso = utcStart.toISOString();

	const utcEnd = new Date(end);
	utcEnd.setDate(utcEnd.getDate() + 1); // Go to next day
	utcEnd.setHours(utcEnd.getHours() - 8); // 00:00 - 8h = 16:00 requested day (which is end of requested day in Manila)
	const endIso = utcEnd.toISOString();

	const [{ data: txPayments }, { data: txDeposits }] = await Promise.all([
		// 1. Fetch Sales (Payments)
		supabase
			.from("payments")
			.select(
				"id, amount, method, paid_at, orders:order_id(id, status, total, table_sessions:table_session_id(id, customer_name, location_name, pool_tables:pool_table_id(name)), reservations(pool_tables:pool_table_id(name)), profiles:profile_id(full_name))",
			)
			.gte("paid_at", startIso)
			.lt("paid_at", endIso)
			.order("paid_at", { ascending: false }),
		// 2. Fetch Wallet Deposits
		supabase
			.from("wallet_transactions")
			.select(
				"id, amount, created_at, wallet:wallet_id(profiles(full_name))",
			)
			.eq("type", "DEPOSIT")
			.eq("type", "DEPOSIT")
			.gte("created_at", startIso)
			.lt("created_at", endIso)
			.order("created_at", { ascending: false }),
	]);

	// Merge and sort transactions
	const rawPayments = (txPayments as any[]) ?? [];
	const deposits = (txDeposits as any[]) ?? [];

	const payments = rawPayments
		.filter((p) => {
			const status = p.orders?.status;
			return status !== "VOIDED" && status !== "CANCELLED";
		})
		.map((p) => ({
			...p,
			// Cap the displayed amount at the Order Total to avoid showing "90,000" for a "300" sale.
			// This matches the "Gross Sales" calculation.
			formattedAmount: (p.orders?.total !== null && p.orders?.total !== undefined)
				? Math.min(Number(p.amount), Number(p.orders.total))
				: Number(p.amount)
		}));

	const combinedTx = [
		...payments.map(p => ({
			...p,
			amount: p.formattedAmount
		})),
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

	return { data: combinedTx };
}

/**
 * Fetches all the raw data the reports views need for a given date range.
 *
 * We:
 * - Reuse the existing SQL helpers (total_revenue, revenue_by_category, etc.)
 * - Return simple arrays so UI sections stay easy to reason about
 * - Keep this as the single source of truth for reporting queries
 */


/**
 * Fetches all the raw data the reports views need for a given date range.
 *
 * We:
 * - Reuse the existing SQL helpers (total_revenue, revenue_by_category, etc.)
 * - Return simple arrays so UI sections stay easy to reason about
 * - Keep this as the single source of truth for reporting queries
 */
export async function getReportData(startStr: string, endStr: string, supabaseClient?: any): Promise<ReportData> {
	const supabase = supabaseClient ?? createSupabaseServerClient();
	const start = new Date(startStr);
	const end = new Date(endStr);

	// Calculate Previous Period (Same Duration)
	const durationMs = end.getTime() - start.getTime();
	const prevEnd = new Date(start.getTime() - 86400000); // 1 day before start
	const prevStart = new Date(prevEnd.getTime() - durationMs);

	// Helper to format date as YYYY-MM-DD for RPC
	const toProDate = (d: Date) => d.toISOString().split('T')[0];

	// Run RPCs in parallel
	const [
		{ data: totalRevenue },
		{ data: prevRevenue }, // Comparison
		{ data: byCategory },
		{ data: _byMethodRpc }, // unused, we override it below
		{ data: byShift },
		{ data: combinedTx },
		{ data: daily },
		{ data: hourly }, // New
		{ data: drinkMargins },
		{ data: categoryMargins },
		{ data: expenses },
		{ data: monthly },
		{ data: byTable },
		{ data: topCustomers },
		{ data: walletLiability },
	] = await Promise.all([
		supabase.rpc("total_revenue", { p_start: startStr, p_end: endStr }),
		supabase.rpc("total_revenue", { p_start: toProDate(prevStart), p_end: toProDate(prevEnd) }),
		supabase.rpc("revenue_by_category", { p_start: startStr, p_end: endStr }),
		supabase.rpc("revenue_by_method", { p_start: startStr, p_end: endStr }), // Corrected: RPC call for byMethod
		supabase.rpc("revenue_by_shift", { p_start: startStr, p_end: endStr }),
		fetchTransactionsWithDetails(supabase, startStr, endStr), // Helper function for complex tx query
		supabase.rpc("daily_revenue", { p_start: startStr, p_end: endStr }),
		supabase.rpc("revenue_by_hour", { p_start: startStr, p_end: endStr }),
		supabase.rpc("margin_by_drink_type", { p_start: startStr, p_end: endStr }),
		supabase.rpc("margin_by_category", { p_start: startStr, p_end: endStr }),
		supabase.rpc("get_expenses", { p_start: startStr, p_end: endStr }),
		supabase.rpc("monthly_financial_summary", { p_start: startStr, p_end: endStr }),
		supabase.rpc("revenue_by_table", { p_start: startStr, p_end: endStr }),
		supabase.rpc("get_top_customers", { p_start: startStr, p_end: endStr }),
		supabase.rpc("get_wallet_liability"),
	]);

	// Derive byMethod from combinedTx (Sales Only)
	const byMethodMap = new Map<string, number>();
	let walletDeposits = 0;

	(combinedTx as any[] ?? []).forEach((tx: any) => {
		// Normalize Method Name (Handle "Charge to Table " vs "Charge to Table")
		let rawMethod = (tx.method || 'UNKNOWN').trim();

		// Optional: Standardize casing if needed (e.g. all uppercase or Title Case)
		// For now, just trim is usually enough, but let's be safe against case diffs
		// If user wants specific display, we can map it.
		// Let's coerce to Title Case for display consistency if it's "CHARGE_TO_TABLE"
		if (rawMethod.replace(/_/g, ' ').toUpperCase() === 'CHARGE TO TABLE') {
			rawMethod = 'Charge to Table';
		}

		// Use the calculated amount (safe zero-total handled below) using new logic
		// We trust formattedAmount which now handles zero-total scenario
		const amount = Number(tx.formattedAmount || 0);

		if (rawMethod === 'WALLET_TOPUP') {
			walletDeposits += amount;
		} else {
			const current = byMethodMap.get(rawMethod) ?? 0;
			byMethodMap.set(rawMethod, current + amount);
		}
	});

	const byMethod = Array.from(byMethodMap.entries()).map(([method, revenue]) => ({
		method,
		revenue
	}));

	const total = Math.round(Number(totalRevenue ?? 0));
	const prev = Math.round(Number(prevRevenue ?? 0));

	// Calculate Trend %
	let trendPct = 0;
	if (prev > 0) {
		trendPct = ((total - prev) / prev) * 100;
	} else if (total > 0) {
		trendPct = 100; // 0 to something is 100% growth effectively (or infinite)
	}

	// Financials Calculation (Sales vs Cash)
	const salesRevenue = total; // Gross Sales (Accrual)

	// Calculate Cash Collected (Cash + Gcash + Deposits)
	// We need to fetch deposits separately or derive them.
	// Currently `revenue_by_method` gives us Payment Methods (Cash, Gcash, Wallet, etc) for SALES.
	// It does NOT include Wallet Deposits (which are Money In but not Sales).
	// We need to fetch Total Deposits for the period.

	// Re-using the tx list to find deposits is inefficient if list is paginated, 
	// but here fetchTransactionsWithDetails returns ALL for the period? 
	// Yes, `fetchTransactionsWithDetails` seems to fetch all without limit (based on code reading previously).
	// Let's optimize: checking `tx` array for DEPOSIT type.

	// Optimization: Calculated above during iteration
	// const walletDeposits = ...

	// Calculate specific sums for breakdown
	const cashSales = (byMethod as any[] ?? [])
		.filter((m: any) => m.method === "CASH")
		.reduce((sum: number, m: any) => sum + Number(m.revenue), 0);
	const gcashSales = (byMethod as any[] ?? [])
		.filter((m: any) => m.method === "GCASH")
		.reduce((sum: number, m: any) => sum + Number(m.revenue), 0);
	const otherSales = (byMethod as any[] ?? [])
		.filter(
			(m: any) =>
				m.method !== "CASH" &&
				m.method !== "GCASH" &&
				m.method !== "WALLET" &&
				m.method !== "WALLET_TOPUP",
		)
		.reduce((sum: number, m: any) => sum + Number(m.revenue), 0);

	const walletUsage = (byMethod as any[] ?? [])
		.filter((m: any) => m.method === 'WALLET')
		.reduce((sum: number, m: any) => sum + Number(m.revenue), 0);

	const cashCollected = cashSales + gcashSales + walletDeposits + otherSales;

	// Expenses
	const totalExpenses = (expenses as any[] ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0);

	const netProfit = salesRevenue - totalExpenses;
	const cashFlow = cashCollected - totalExpenses;

	// Categories
	const catMap = new Map<string, number>();
	(byCategory as any[] ?? []).forEach((c: any) => {
		catMap.set(c.category, Number(c.revenue));
	});

	// Explicit Category Mapping
	const poolSales = catMap.get('TABLE_TIME') ?? 0;
	const foodSales = catMap.get('FOOD') ?? 0;
	const drinkSales = catMap.get('DRINK') ?? 0;

	// Calculate "Other" category (Everything else)
	const knownCategories = poolSales + foodSales + drinkSales;
	const otherCategorySales = Math.max(0, salesRevenue - knownCategories);


	return {
		total,
		previousTotal: prev,
		trendPct,
		tx: combinedTx,
		daily: (daily as any[] | null) ?? [],
		hourly: (hourly as any[] | null) ?? [],
		byCategory: (byCategory as any[] | null) ?? [],
		byMethod: (byMethod as any[] | null) ?? [],
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
