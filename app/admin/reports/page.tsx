export const dynamic = "force-dynamic";

import { getReportData } from "./data";
import { OverviewSection } from "./sections/OverviewSection";
import { SalesAndMarginsSection } from "./sections/SalesAndMarginsSection";
import { ShiftsAndBeveragesSection } from "./sections/ShiftsAndBeveragesSection";
import { MonthlyOverviewSection } from "./sections/MonthlyOverviewSection";
import { OperationsSection } from "./sections/OperationsSection";
import { ExpensesSection } from "./sections/ExpensesSection";

type View = "summary" | "daily" | "monthly" | "expenses";

function getTodayRange() {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	const today = `${yyyy}-${mm}-${dd}`;
	return { start: today, end: today };
}

function parseView(raw: unknown): View {
	const v = typeof raw === "string" ? raw : "";
	if (v === "daily" || v === "monthly" || v === "expenses") return v;
	return "summary";
}

function buildViewHref(view: View, start: string, end: string) {
	const params = new URLSearchParams();
	params.set("view", view);
	params.set("start", start);
	params.set("end", end);
	return `?${params.toString()}`;
}

export default async function ReportsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[]>>;
}) {
	const { start: todayStart, end: todayEnd } = getTodayRange();
	const sp = await searchParams;

	const start = (sp?.start as string) ?? todayStart;
	const end = (sp?.end as string) ?? todayEnd;
	const view = parseView(sp?.view);

	// Human-friendly label for the selected period so the UI always
	// reminds you which dates the metrics are based on.
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

	const tabs: { id: View; label: string }[] = [
		{ id: "summary", label: "Summary" },
		{ id: "daily", label: "Daily detail" },
		{ id: "monthly", label: "Monthly" },
		{ id: "expenses", label: "Expenses" },
	];

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">
						Reports &amp; Analytics
					</h1>
					<p className="text-xs text-neutral-400">
						Daily and monthly performance for the selected date range.
					</p>
					<p className="text-[0.7rem] text-neutral-500">Period: {rangeLabel}</p>
				</div>
			</div>

			{/* View tabs – keep everything server-rendered and share the same date range */}
			<nav className="flex flex-wrap gap-2 text-xs">
				{tabs.map((tab) => {
					const href = buildViewHref(tab.id, start, end);
					const isActive = view === tab.id;
					return (
						<a
							key={tab.id}
							href={href}
							className={[
								"rounded-full border px-3 py-1",
								isActive
									? "border-white/60 bg-white text-neutral-900"
									: "border-white/10 bg-white/5 text-neutral-300 hover:border-white/30",
							].join(" ")}
						>
							{tab.label}
						</a>
					);
				})}
			</nav>

			{/* Period selector – reuses the same view + dates in query params */}
			<form className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<div className="flex flex-wrap items-end gap-3">
					<input type="hidden" name="view" value={view} />
					<div>
						<label className="mb-1 block text-xs text-neutral-300">Start date</label>
						<input
							type="date"
							name="start"
							defaultValue={start}
							className="rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-neutral-300">End date</label>
						<input
							type="date"
							name="end"
							defaultValue={end}
							className="rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
						/>
					</div>
					<button
						type="submit"
						className="rounded-full bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-200"
					>
						Apply
					</button>
				</div>
			</form>

			{/* View-specific content */}
			{view === "summary" && (
				<>
					<OverviewSection
						totalRevenue={totalRevenue}
						totalTransactions={totalTransactions}
						averageTicket={averageTicket}
						totalExpenses={totalExpenses}
						netProfit={netProfit}
						netMargin={netMargin}
					/>
					<ShiftsAndBeveragesSection
						byShift={data.byShift ?? []}
						drinkMargins={data.drinkMargins ?? []}
					/>
					<MonthlyOverviewSection monthly={data.monthly ?? []} />
				</>
			)}

			{view === "daily" && (
				<>
					<OverviewSection
						totalRevenue={totalRevenue}
						totalTransactions={totalTransactions}
						averageTicket={averageTicket}
						totalExpenses={totalExpenses}
						netProfit={netProfit}
						netMargin={netMargin}
					/>
					<SalesAndMarginsSection
						totalRevenue={totalRevenue}
						daily={data.daily ?? []}
						byCategory={data.byCategory ?? []}
						byMethod={data.byMethod ?? []}
						categoryMargins={data.categoryMargins ?? []}
					/>
					<ShiftsAndBeveragesSection
						byShift={data.byShift ?? []}
						drinkMargins={data.drinkMargins ?? []}
					/>
					<OperationsSection byTable={data.byTable ?? []} transactions={data.tx ?? []} />
				</>
			)}

			{view === "monthly" && (
				<MonthlyOverviewSection monthly={data.monthly ?? []} />
			)}

			{view === "expenses" && (
				<>
					<OverviewSection
						totalRevenue={totalRevenue}
						totalTransactions={totalTransactions}
						averageTicket={averageTicket}
						totalExpenses={totalExpenses}
						netProfit={netProfit}
						netMargin={netMargin}
					/>
					<ExpensesSection startDate={start} expenses={data.expenses ?? []} />
				</>
			)}
		</div>
	);
}


