import { formatCurrency, formatPercent } from "../format";
import { StatCard } from "@/app/components/ui/StatCard";

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
				<StatCard label="Gross sales" value={formatCurrency(totalRevenue)} />
				<StatCard label="Total transactions" value={totalTransactions} />
				<StatCard label="Average ticket" value={formatCurrency(averageTicket)} />
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<StatCard label="Total expenses" value={formatCurrency(totalExpenses)} />
				<StatCard label="Net profit" value={formatCurrency(netProfit)} />
				<StatCard label="Net margin" value={formatPercent(netMargin)} />
			</div>
		</div>
	);
}



