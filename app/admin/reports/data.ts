import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface ReportData {
	total: number | null;
	byCategory: any[] | null; // Legacy RPC result (keep for summary)
	byMethod: any[] | null;
	tx: any[] | null;

	// New Granular Data Structures
	dailyStats: {
		date: string;
		shifts: {
			morning: DailyShiftStats;
			evening: DailyShiftStats;
		};
		totalRevenue: number;
		expenses: {
			[category: string]: number;
		}
	}[];

	overallStats: {
		salesByItemCategory: { // Table vs Food vs Beverage
			table: number;
			food: number;
			beverage: number; // Total Beverage
			beverageByGeneric: number; // Generic Drink (if any)
			merch: number;
			other: number;
		};
		salesByTable: {
			[tableName: string]: number;
		};
		beverageDrilldown: {
			alcoholic: number;
			nonAlcoholic: number;
			mixed: number; // For "Cocktails" or similar if distinguishable
		};
		expensesByCategory: {
			category: string;
			amount: number;
		}[];
	};

	// Keep existing ones for compatibility with existing Views if needed
	expenses: any[] | null;
	monthly: any[] | null;
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
	topCustomers: any[] | null;
	walletLiability: number | null;
	daily: any[] | null; // Legacy daily revenue
	byTable: any[] | null; // restore
	byShift: any[] | null; // restore
	drinkMargins: any[] | null; // restore
	categoryMargins: any[] | null; // restore
	previousTotal?: number; // restore
	trendPct?: number; // restore
	hourly?: any[] | null; // restore
	liabilities?: WalletLiability[] | null;
	walkInLiabilities?: WalkInLiability[] | null;
}

export interface WalletLiability {
	id: string;
	profile_id: string;
	balance: number;
	profiles: {
		full_name: string;
		phone: string | null;
	} | null;
}

export interface WalkInLiability {
	session_id: string;
	customer_name: string;
	opened_at: string;
	amount: number;
	profile?: {
		full_name: string;
		phone: string | null;
	} | null;
}

interface DailyShiftStats {
	revenue: number;
	tableSales: number;
	foodSales: number;
	beverageSales: {
		total: number;
		alcoholic: number;
		nonAlcoholic: number;
		mixed: number;
	};
}

// Helper to determine shift
// Morning: 10:00 AM - 6:00 PM
// Evening: 6:00 PM - Closing (Next Day ~4am)
// We assign a transaction to the "Business Day" it belongs to.
// We assume the upstream `start/end` dates are already "Business Date" aware or we use the `paid_at` to figure it out.
function getShift(paidAt: string | Date): "morning" | "evening" {
	const d = new Date(paidAt);
	// In Manila Time, assuming server returns UTC ISO strings.
	// We need to convert to Manila Hour. 
	// Simplest way: UTC+8.
	const utcHour = d.getUTCHours();
	const manilaHour = (utcHour + 8) % 24;

	// Morning: 10:00 (10) to 17:59 (17)
	// Evening: 18:00 (18) to 09:59 (9) next day
	if (manilaHour >= 11 && manilaHour < 18) {
		return "morning";
	}
	return "evening";
}

// Helper: Get Business Date YYYY-MM-DD
// If hour < 10 (AM), it belongs to previous day.
function getBusinessDate(paidAt: string | Date): string {
	const d = new Date(paidAt);
	const utcHour = d.getUTCHours();
	const manilaHour = (utcHour + 8) % 24;

	// If between 00:00 and 10:00 Manila, subtract 1 day
	// But let's work with Manila time object
	const dManila = new Date(d.getTime() + (8 * 60 * 60 * 1000));
	if (dManila.getUTCHours() < 10) {
		dManila.setUTCDate(dManila.getUTCDate() - 1);
	}
	return dManila.toISOString().split('T')[0];
}

async function fetchTransactionsWithDetails(supabase: any, start: string, end: string) {
	// Strict Timestamp Range Logic (same as before)
	const utcStart = new Date(start);
	utcStart.setUTCHours(2, 0, 0, 0); // 10am Manila (-8) = 2am UTC
	const startIso = utcStart.toISOString();

	const utcEnd = new Date(end);
	utcEnd.setDate(utcEnd.getDate() + 1);
	utcEnd.setUTCHours(2, 0, 0, 0);
	const endIso = utcEnd.toISOString();

	const [{ data: txPayments }, { data: txDeposits }] = await Promise.all([
		supabase
			.from("payments")
			.select(`
				id, amount, method, paid_at,
				orders:order_id(
					id, status, total,
					table_sessions:table_session_id(
						id, customer_name, location_name,
						pool_tables:pool_table_id(name)
					),
					order_items(
						quantity, line_total,
						products:product_id(
							name, category, is_alcoholic
						)
					)
				)
			`)
			.gte("paid_at", startIso)
			.lt("paid_at", endIso)
			.order("paid_at", { ascending: false }),
		supabase
			.from("wallet_transactions")
			.select("id, amount, created_at, wallet:wallet_id(profiles(full_name))")
			.eq("type", "DEPOSIT")
			.gte("created_at", startIso)
			.lt("created_at", endIso)
			.order("created_at", { ascending: false }),
	]);

	// Processing Logic
	const rawPayments = (txPayments as any[]) ?? [];
	const deposits = (txDeposits as any[]) ?? [];

	// 1. Process Stats
	const dailyStatsMap = new Map<string, {
		morning: DailyShiftStats;
		evening: DailyShiftStats;
		expenses: { [cat: string]: number };
	}>();

	const overallStats = {
		salesByItemCategory: { table: 0, food: 0, beverage: 0, beverageByGeneric: 0, merch: 0, other: 0 },
		salesByTable: {} as { [table: string]: number },
		beverageDrilldown: { alcoholic: 0, nonAlcoholic: 0, mixed: 0 },
		expensesByCategory: [] as any[]
	};

	// Init helper for daily map
	const getDayEntry = (date: string) => {
		if (!dailyStatsMap.has(date)) {
			dailyStatsMap.set(date, {
				morning: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
				evening: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
				expenses: {}
			});
		}
		return dailyStatsMap.get(date)!;
	};

	const combinedTx: any[] = [];

	// Iterate Payments (Sales)
	for (const p of rawPayments) {
		if (p.orders?.status === "VOIDED" || p.orders?.status === "CANCELLED") continue;

		// Cap logic
		const finalAmount = (p.orders?.total !== null && p.orders?.total !== undefined)
			? Math.min(Number(p.amount), Number(p.orders.total))
			: Number(p.amount);

		combinedTx.push({ ...p, formattedAmount: finalAmount });

		const bizDate = getBusinessDate(p.paid_at);
		const shift = getShift(p.paid_at);
		const dayStats = getDayEntry(bizDate);
		const targetShift = dayStats[shift];

		// Attribute Revenue
		targetShift.revenue += finalAmount;

		// Attribute Table Sales (for Table Performance Chart)
		// We attribute the ENTIRE payment to the table if it's linked to a table session.
		// Even if they bought food/drinks, it's "Sales generated by this Table".
		// Note from user request: "Per Table Sales" ... "predator table ... 33.3% of ALL its sales".
		const tableName = p.orders?.table_sessions?.pool_tables?.name;
		if (tableName) {
			overallStats.salesByTable[tableName] = (overallStats.salesByTable[tableName] || 0) + finalAmount;
		}

		// Attribute Category Breakdown (Approximate if partial payment, but usually full)
		// Best effort: Distribute `finalAmount` proportionally if `finalAmount != order.total`
		// But for now assume 100% payment ratio for categorization stats to keep it simple,
		// OR calculate ratios. Let's calculate ratios to be precise.
		const orderTotal = Number(p.orders?.total || finalAmount) || 1; // avoid div 0
		const ratio = finalAmount / orderTotal;

		// Fallback: If no order items (e.g. quick sale or pure table?), check table session
		// If table session exists, it's likely Table Time sales for the session part, but items might be food/drink.
		// Wait, `order_items` usually contains the Line Items.
		// If `table_sessions` is present, there might be a "Table Charge" that is NOT in `order_items`? 
		// Typically Table Time is a line item "Table Rental" or similar in some systems, 
		// OR it is a separate calculated field.
		// Let's assume: If `order_items` sum < `orderTotal`, the difference is Table Time (if table session exists).

		const items = p.orders?.order_items ?? [];

		let itemsSum = 0;
		let tableTimeAmt = 0;

		for (const item of items) {
			const itemTotal = Number(item.line_total || 0) * ratio;
			itemsSum += itemTotal;

			const cat = item.products?.category ?? "OTHER";
			const isAlcoholic = item.products?.is_alcoholic; // boolean

			// Categorize
			if (cat === "FOOD") {
				targetShift.foodSales += itemTotal;
				overallStats.salesByItemCategory.food += itemTotal;
			} else if (cat === "DRINK") {
				targetShift.beverageSales.total += itemTotal;
				overallStats.salesByItemCategory.beverage += itemTotal;

				if (isAlcoholic) {
					targetShift.beverageSales.alcoholic += itemTotal;
					overallStats.beverageDrilldown.alcoholic += itemTotal;
				} else {
					targetShift.beverageSales.nonAlcoholic += itemTotal;
					overallStats.beverageDrilldown.nonAlcoholic += itemTotal;
				}
			} else if (cat === "TABLE_TIME" || cat === "POOL") {
				// explicit table time item
				targetShift.tableSales += itemTotal;
				overallStats.salesByItemCategory.table += itemTotal;
			} else {
				overallStats.salesByItemCategory.other += itemTotal;
			}
		}

		// Heuristic data fix: If Items Sum < Revenue, and it's a Table Session, treat remainder as Table Time.
		if (itemsSum < finalAmount - 1) { // -1 for roundoff tolerance
			const remainder = finalAmount - itemsSum;
			if (p.orders?.table_sessions) {
				tableTimeAmt = remainder;
				targetShift.tableSales += remainder;
				overallStats.salesByItemCategory.table += remainder;
			} else {
				// Unknown remainder
				overallStats.salesByItemCategory.other += remainder;
			}
		}
	}

	// Add Deposits to combinedTx
	for (const d of deposits) {
		combinedTx.push({
			id: d.id,
			amount: d.amount,
			method: "WALLET_TOPUP",
			paid_at: d.created_at,
			orders: {
				id: "TOPUP",
				total: d.amount,
				table_sessions: {
					id: "WALLET",
					pool_tables: {
						name: d.wallet?.profiles?.full_name ? `Top-up: ${d.wallet.profiles.full_name}` : "Wallet Top-up",
					},
				},
			},
		});
	}
	combinedTx.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());

	return { combinedTx, dailyStatsMap, overallStats };
}

export async function getReportData(startStr: string, endStr: string, supabaseClient?: any): Promise<ReportData> {
	const supabase = supabaseClient ?? createSupabaseServerClient();

	const startYear = new Date(startStr).getFullYear();
	const yearStartStr = `${startYear}-01-01`;

	// Fetch Expenses separately to mix into Daily Stats
	const { data: expenses } = await supabase.rpc("get_expenses", { p_start: startStr, p_end: endStr });

	// Main Fetch
	const { combinedTx, dailyStatsMap, overallStats } = await fetchTransactionsWithDetails(supabase, startStr, endStr);

	// Process Expenses into Daily Map
	const expenseList = (expenses as any[]) ?? [];
	expenseList.forEach((exp: any) => {
		// exp: { expense_date, category, amount, ... }
		// expense_date is likely YYYY-MM-DD
		const date = exp.expense_date;
		// If expense date falls within our requested range (it should due to RPC filter)
		if (dailyStatsMap.has(date)) {
			const entry = dailyStatsMap.get(date)!;
			const currentCat = entry.expenses[exp.category] || 0;
			entry.expenses[exp.category] = currentCat + Number(exp.amount);
		} else {
			// Possibly expense exists on a day with no sales?
			// Create entry
			dailyStatsMap.set(date, {
				morning: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
				evening: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
				expenses: { [exp.category]: Number(exp.amount) }
			});
		}

		// Overall Expense Stats
		const overallExp = overallStats.expensesByCategory.find(e => e.category === exp.category);
		if (overallExp) {
			overallExp.amount += Number(exp.amount);
		} else {
			overallStats.expensesByCategory.push({ category: exp.category, amount: Number(exp.amount) });
		}
	});

	// Calculate Predator Rent (Combined Sales)
	const predatorTables = Object.keys(overallStats.salesByTable).filter(k => k.toLowerCase().includes("predator"));
	const predatorSales = predatorTables.reduce((sum, table) => sum + (overallStats.salesByTable[table] || 0), 0);
	const predatorRent = predatorSales * 0.333;

	// Inject Predator Rent into Expenses
	if (predatorRent > 0) {
		const rentexp = {
			id: "PREDATOR-RENT",
			category: "Predator Rent (33.3% of Sales)",
			description: "Auto-calculated Rent",
			amount: predatorRent,
			expense_date: endStr, // Attribute to end of period
			created_at: new Date().toISOString()
		};
		// Add to main expense list (for Admin View)
		expenseList.push(rentexp);

		// Add to overall stats (for Report View)
		overallStats.expensesByCategory.push({
			category: rentexp.category,
			amount: rentexp.amount
		});

		// Add to Daily Stats (attribute to last day or spread? Last day is safest for monthly)
		const lastDayKey = endStr; // Use end date of report
		if (dailyStatsMap.has(lastDayKey)) {
			const d = dailyStatsMap.get(lastDayKey)!;
			d.expenses[rentexp.category] = rentexp.amount;
		} else {
			// If last day has no sales, it might not be in map if map only populated by payments? 
			// Logic above populates map from expenses too. 
			// But if expenseList injection happens AFTER the loop that populates dailyStatsMap from expenseList, we need to manually update map here.
			// We are currently AFTER the expenseList.forEach loop.
			// So we must manually update dailyStatsMap.
			if (dailyStatsMap.has(lastDayKey)) {
				dailyStatsMap.get(lastDayKey)!.expenses[rentexp.category] = rentexp.amount;
			} else {
				dailyStatsMap.set(lastDayKey, {
					morning: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
					evening: { revenue: 0, tableSales: 0, foodSales: 0, beverageSales: { total: 0, alcoholic: 0, nonAlcoholic: 0, mixed: 0 } },
					expenses: { [rentexp.category]: rentexp.amount }
				});
			}
		}
	}

	// Transform Map to Array for Report
	// Sort by Date
	const dailyStats = Array.from(dailyStatsMap.entries())
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([date, stats]) => ({
			date,
			shifts: stats,
			totalRevenue: stats.morning.revenue + stats.evening.revenue,
			expenses: stats.expenses
		}));

	// Fallback/Legacy Data Fetching (Parallel) for Summary Views compatibility
	const [
		{ data: totalRevenue },
		{ data: prevRevenue },
		{ data: byCategory },
		{ data: _ }, // method (legacy)
		{ data: byShift }, // legacy shift
		{ data: daily }, // legacy daily
		{ data: monthly },
		{ data: topCustomers },
		{ data: walletLiability },
		{ data: liabilities },
		{ data: walkInLiabilities },
	] = await Promise.all([
		supabase.rpc("total_revenue", { p_start: startStr, p_end: endStr }),
		supabase.rpc("total_revenue", { p_start: "2000-01-01", p_end: "2000-01-01" }), // Skip prev rev for now or calc simple
		supabase.rpc("revenue_by_category", { p_start: startStr, p_end: endStr }),
		supabase.rpc("revenue_by_method", { p_start: startStr, p_end: endStr }),
		supabase.rpc("revenue_by_shift", { p_start: startStr, p_end: endStr }),
		supabase.rpc("daily_revenue", { p_start: startStr, p_end: endStr }),
		supabase.rpc("monthly_financial_summary", { p_start: yearStartStr, p_end: endStr }),
		supabase.rpc("get_top_customers", { p_start: startStr, p_end: endStr }),
		supabase.rpc("get_wallet_liability"),
		supabase.rpc("get_wallet_liabilities_report"),
		supabase
			.from("table_sessions")
			.select(`
				id, 
				customer_name, 
				opened_at, 
				orders!inner(total, profile_id),
				pool_table_id,
				status
			`)
			.eq("status", "OPEN")
			.is("pool_table_id", null)
			.order("opened_at", { ascending: false }),
	]);

	// Process Walk-in Liabilities
	const processedWalkIns = (walkInLiabilities as any[] ?? []).map((s: any) => ({
		session_id: s.id,
		customer_name: s.customer_name || "Walk-in",
		opened_at: s.opened_at,
		amount: s.orders?.[0]?.total ?? 0,
	}));

	// Process RPC Wallet Liabilities
	const processedLiabilities = (liabilities as any[] ?? []).map((l: any) => ({
		id: l.wallet_id,
		profile_id: l.profile_id,
		balance: l.balance,
		profiles: {
			full_name: l.full_name,
			phone: l.phone
		}
	}));

	// Legacy Financials Construction (Quick and dirty from new data to ensure consistency)
	const totalRev = combinedTx
		.filter((t: any) => t.method !== "WALLET_TOPUP")
		.reduce((sum: number, t: any) => sum + Number(t.formattedAmount), 0);

	const totalExp = expenseList.reduce((sum, e) => sum + Number(e.amount), 0);

	// Quick Method Breakdown
	const methods = new Map<string, number>();
	combinedTx.forEach((t: any) => {
		if (t.method === "WALLET_TOPUP") return;
		const m = t.method || "UNKNOWN";
		methods.set(m, (methods.get(m) || 0) + t.formattedAmount);
	});

	// Legacy Return
	return {
		total: totalRev,
		previousTotal: 0,
		trendPct: 0,
		tx: combinedTx,
		daily: daily ?? [],
		byCategory: byCategory ?? [],
		byMethod: Array.from(methods.entries()).map(([m, v]) => ({ method: m, revenue: v })),
		byTable: [],
		byShift: byShift ?? [],
		drinkMargins: [],
		categoryMargins: [],
		expenses: expenseList,
		monthly: monthly ?? [],
		topCustomers: topCustomers ?? [],
		walletLiability: walletLiability as number,
		financials: {
			sales: totalRev,
			totalExpenses: totalExp,
			cashCollected: totalRev, // Simplify for now (assumes accrual = cash approx minus receivables)
			walletUsage: methods.get("WALLET") ?? 0,
			netProfit: totalRev - totalExp,
			cashFlow: totalRev - totalExp,
			breakdown: {
				cash: methods.get("CASH") ?? 0,
				gcash: methods.get("GCASH") ?? 0,
				other: 0,
				deposits: combinedTx.filter((t: any) => t.method === "WALLET_TOPUP").reduce((s, t) => s + t.amount, 0)
			},
			categories: {
				pool: overallStats.salesByItemCategory.table,
				food: overallStats.salesByItemCategory.food,
				drinks: overallStats.salesByItemCategory.beverage,
				other: overallStats.salesByItemCategory.other
			}
		},
		dailyStats,
		overallStats,
		liabilities: processedLiabilities as WalletLiability[],
		walkInLiabilities: processedWalkIns as WalkInLiability[],
	};
}

