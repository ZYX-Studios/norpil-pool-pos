export const dynamic = "force-dynamic";

import { getReportData } from "./data";
import { OverviewSection } from "./sections/OverviewSection";
import { SalesAndMarginsSection } from "./sections/SalesAndMarginsSection";
import { ShiftsAndBeveragesSection } from "./sections/ShiftsAndBeveragesSection";
import { MonthlyOverviewSection } from "./sections/MonthlyOverviewSection";
import { MonthlyDetailSection } from "./sections/MonthlyDetailSection";
import { OperationsSection } from "./sections/OperationsSection";
import { ExpensesSection } from "./sections/ExpensesSection";
import { Tabs } from "@/app/components/ui/Tabs";
import { DateRangePicker } from "@/app/components/ui/DateRangePicker";
import { DownloadReportButton } from "./pdf/DownloadReportButton";
import { MonthlyMetrics } from "./components/MonthlyMetrics";
import { MonthlyFinancials } from "./components/MonthlyFinancials";
import { DailyTrendChart } from "./components/DailyTrendChart";

type View = "summary" | "daily" | "monthly" | "expenses";

function getTodayRange() {
	const now = new Date();
	const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" };
	const formatter = new Intl.DateTimeFormat("en-CA", options); // en-CA gives YYYY-MM-DD
	const today = formatter.format(now);
	return { start: today, end: today };
}

function getMonthRange() {
	const now = new Date();
	const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" };
	const formatter = new Intl.DateTimeFormat("en-CA", options);

	// Get first day of month in Manila
	const startParts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Manila", year: "numeric", month: "numeric", day: "numeric" }).formatToParts(now);
	const year = startParts.find(p => p.type === "year")?.value;
	const month = startParts.find(p => p.type === "month")?.value?.padStart(2, "0");
	const start = `${year}-${month}-01`;

	// Get last day of month
	// We can cheat: take first day of *next* month minus 1 day, ensuring we do this in Manila time logic
	// But simpler: just get the current date in Manila, get year/month, construct Date object, etc.
	// Actually, careful with "new Date()" construction as it uses local environment.
	// Let's stick effectively to string manipulation for the Start, and for End we can use the "Server" time 
	// but mostly we want the current month context.

	// Let's refine:
	const manilaDate = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Manila" }));
	const yyyy = manilaDate.getFullYear();
	const mm = String(manilaDate.getMonth() + 1).padStart(2, "0");
	const startStr = `${yyyy}-${mm}-01`;

	const lastDay = new Date(yyyy, manilaDate.getMonth() + 1, 0).getDate();
	const endStr = `${yyyy}-${mm}-${String(lastDay).padStart(2, "0")}`;

	return { start: startStr, end: endStr };
}

function parseView(raw: unknown): View {
	const v = typeof raw === "string" ? raw : "";
	if (v === "daily" || v === "monthly" || v === "expenses") return v;
	return "summary";
}

import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export default async function ReportsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[]>>;
}) {
	const { staff: currentStaff } = await getCurrentUserWithStaff();
	if (currentStaff?.role !== "ADMIN") redirect("/admin");

	const { start: todayStart, end: todayEnd } = getTodayRange();
	const { start: monthStart, end: monthEnd } = getMonthRange();
	const sp = await searchParams;
	const view = parseView(sp?.view);

	// Determine default range based on view
	// If monthly view and no explicit range, default to whole month
	let defaultStart = todayStart;
	let defaultEnd = todayEnd;
	if (view === "monthly" && !sp?.start && !sp?.end) {
		defaultStart = monthStart;
		defaultEnd = monthEnd;
	}

	const start = (sp?.start as string) ?? defaultStart;
	const end = (sp?.end as string) ?? defaultEnd;

	// Human-friendly label for the selected period
	const startLabel = new Date(start).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const endLabel = new Date(end).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
	const rangeLabel = start === end ? startLabel : `${startLabel} – ${endLabel}`;

	// Load all reporting data for the selected range.
	const data = await getReportData(start, end);

	const totalRevenue = Number(data.total ?? 0);
	const txArray = data.tx ?? [];
	const totalTransactions = txArray.length;
	const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

	const expenseArray = data.expenses ?? [];
	let totalExpenses = 0;
	for (const row of expenseArray) {
		totalExpenses += Number(row.amount ?? 0);
	}
	const netProfit = totalRevenue - totalExpenses;
	const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

	// Calculate wallet metrics for Monthly view (if needed locally, though MonthlyMetrics takes props)
	// data.walletLiability is returned by getReportData in data.ts
	const walletLiability = data.walletLiability ?? 0;

	// Ensure walletDeposits is calculated correctly if not present in data
	const walletDeposits = (data.tx ?? [])
		.filter((t: any) => t.method === 'WALLET_TOPUP')
		.reduce((sum: number, t: any) => sum + Number(t.amount), 0);

	const tabs = [
		{ id: "summary", label: "Summary" },
		{ id: "daily", label: "Daily detail" },
		{ id: "monthly", label: "Monthly" },
		{ id: "expenses", label: "Expenses" },
	];

	return (
		<div className="space-y-6 animate-in fade-in duration-500">
			<div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-2xl font-semibold text-neutral-50 sm:text-3xl">
						Reports &amp; Analytics
					</h1>
					<p className="text-sm text-neutral-400">
						Daily and monthly performance for the selected date range.
					</p>
					<p className="text-sm text-neutral-500 mt-1">Period: {rangeLabel}</p>
				</div>
				<div className="flex items-center gap-2">
					<DownloadReportButton data={data} start={start} end={end} />
					<DateRangePicker defaultStart={start} defaultEnd={end} />
				</div>
			</div>

			<Tabs tabs={tabs} currentView={view} baseUrl="/admin/reports" />

			{/* View-specific content */}
			{view === "summary" && (
				<div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
					<OverviewSection
						totalRevenue={totalRevenue}
						totalTransactions={totalTransactions}
						averageTicket={averageTicket}
						totalExpenses={totalExpenses}
						netProfit={netProfit}
						netMargin={netMargin}
						trendPct={data.trendPct}
					/>
					<ShiftsAndBeveragesSection
						byShift={data.byShift ?? []}
						drinkMargins={data.drinkMargins ?? []}
					/>
					<MonthlyOverviewSection monthly={data.monthly ?? []} />
				</div>
			)}

			{view === "daily" && (
				<div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
					<SalesAndMarginsSection
						totalRevenue={totalRevenue}
						daily={data.daily ?? []}
						hourly={data.hourly ?? []}
						byCategory={data.byCategory ?? []}
						byMethod={data.byMethod ?? []}
						categoryMargins={data.categoryMargins ?? []}
					/>
					<ShiftsAndBeveragesSection
						byShift={data.byShift ?? []}
						drinkMargins={data.drinkMargins ?? []}
					/>
					<OperationsSection byTable={data.byTable ?? []} transactions={data.tx ?? []} />
				</div>
			)}

			{view === "monthly" && (
				<div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
					<MonthlyFinancials data={data.financials} />
					<DailyTrendChart dailyData={data.daily ?? []} />
					<MonthlyMetrics
						topCustomers={data.topCustomers ?? []}
						walletLiability={walletLiability}
						walletDeposits={walletDeposits}
					/>
					<MonthlyDetailSection
						dailyRevenue={data.daily ?? []}
						expenses={data.expenses ?? []}
					/>
				</div>
			)}

			{view === "expenses" && (
				<div className="space-y-6 animate-in slide-in-from-bottom-2 duration-500">
					<ExpensesSection startDate={start} expenses={data.expenses ?? []} />
				</div>
			)}
		</div>
	);
}
