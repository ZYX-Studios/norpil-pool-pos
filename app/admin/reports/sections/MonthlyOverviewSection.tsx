import { formatCurrency, formatPercent } from "../format";

interface MonthlyOverviewSectionProps {
	monthly: any[];
}

/**
 * Monthly financial summary.
 *
 * Answers:
 * - How are gross sales, expenses, and net profit trending by month?
 * - What is the net margin per month over the selected horizon?
 */
export function MonthlyOverviewSection({ monthly }: MonthlyOverviewSectionProps) {
	const rows = monthly ?? [];

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Monthly overview
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Big-picture view of gross, expenses, and net per month in the selected range.
				</p>
			</div>
			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<div className="max-h-56 overflow-auto text-xs text-neutral-200">
					{rows.length > 0 ? (
						<table className="w-full">
							<thead className="text-left text-neutral-400">
								<tr>
									<th className="py-1">Month</th>
									<th className="text-right">Gross</th>
									<th className="text-right">Expenses</th>
									<th className="text-right">Net</th>
									<th className="text-right">Net margin</th>
								</tr>
							</thead>
							<tbody>
								{rows.map((row: any) => {
									const month = row.month_start as string;
									const revenue = Number(row.revenue ?? 0);
									const expenses = Number(row.expenses ?? 0);
									const net = Number(row.net ?? revenue - expenses);
									const marginPct = revenue > 0 ? (net / revenue) * 100 : 0;
									return (
										<tr key={month}>
											<td className="py-1">
												{new Date(month).toLocaleDateString(undefined, {
													year: "numeric",
													month: "short",
												})}
											</td>
											<td className="text-right">{formatCurrency(revenue)}</td>
											<td className="text-right">{formatCurrency(expenses)}</td>
											<td className="text-right">{formatCurrency(net)}</td>
											<td className="text-right">{formatPercent(marginPct)}</td>
										</tr>
									);
								})}
							</tbody>
						</table>
					) : (
						<div className="text-neutral-500">
							No monthly data. Try expanding the date range.
						</div>
					)}
				</div>
			</div>
		</div>
	);
}


