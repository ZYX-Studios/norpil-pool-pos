import { formatCurrency, formatPercent } from "../format";

interface OverviewSectionProps {
	totalRevenue: number;
	totalTransactions: number;
	averageTicket: number;
	totalExpenses: number;
	netProfit: number;
	netMargin: number;
}

/**
 * High-level KPIs for the selected period.
 *
 * Answers:
 * - How much did we sell?
 * - How many transactions?
 * - Are we profitable after expenses?
 */
export function OverviewSection({
	totalRevenue,
	totalTransactions,
	averageTicket,
	totalExpenses,
	netProfit,
	netMargin,
}: OverviewSectionProps) {
	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Overview
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Snapshot of sales, profit, and margin for the selected period.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Gross sales
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{formatCurrency(totalRevenue)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Total transactions
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{totalTransactions}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Average ticket
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{formatCurrency(averageTicket)}
					</div>
				</div>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Total expenses
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{formatCurrency(totalExpenses)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Net profit
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{formatCurrency(netProfit)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">
						Net margin
					</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">
						{formatPercent(netMargin)}
					</div>
				</div>
			</div>
		</div>
	);
}


