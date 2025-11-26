"use client";

import { formatCurrency, formatPercent } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
	Bar,
	CartesianGrid,
	ComposedChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

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

	const chartData = rows.map((row: any) => {
		const revenue = Number(row.revenue ?? 0);
		const expenses = Number(row.expenses ?? 0);
		const net = Number(row.net ?? revenue - expenses);
		return {
			month: new Date(row.month_start).toLocaleDateString(undefined, {
				month: "short",
				year: "2-digit",
			}),
			revenue,
			expenses,
			net,
		};
	});

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Monthly overview
				</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Big-picture trends for gross sales, expenses, and net profit.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-2">
					<div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						Financial trends
					</div>
					<div className="h-64 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<ComposedChart data={chartData}>
								<CartesianGrid
									strokeDasharray="3 3"
									stroke="rgba(255,255,255,0.1)"
									vertical={false}
								/>
								<XAxis
									dataKey="month"
									stroke="#a3a3a3"
									fontSize={10}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="#a3a3a3"
									fontSize={10}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => `$${value / 1000}k`}
								/>
								<Tooltip
									contentStyle={{
										backgroundColor: "#000000",
										borderColor: "#333333",
										color: "#ffffff",
										fontSize: "12px",
										borderRadius: "4px",
										boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
									}}
									itemStyle={{ color: "#e5e5e5" }}
									formatter={(value: number) => formatCurrency(value)}
								/>
								<Bar
									dataKey="revenue"
									name="Revenue"
									fill="#34d399" // emerald-400
									radius={[4, 4, 0, 0]}
									barSize={20}
								/>
								<Bar
									dataKey="expenses"
									name="Expenses"
									fill="#f87171" // red-400
									radius={[4, 4, 0, 0]}
									barSize={20}
								/>
								<Line
									type="monotone"
									dataKey="net"
									name="Net Profit"
									stroke="#fbbf24" // amber-400
									strokeWidth={2}
									dot={{ r: 3, fill: "#fbbf24" }}
								/>
							</ComposedChart>
						</ResponsiveContainer>
					</div>
				</Card>

				<Card className="lg:col-span-1">
					<div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						Monthly breakdown
					</div>
					<div className="max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
						<table className="w-full text-sm">
							<thead className="sticky top-0 bg-[#0a0a0a] text-left text-neutral-400">
								<tr>
									<th className="pb-2 font-medium">Month</th>
									<th className="pb-2 text-right font-medium">Net</th>
									<th className="pb-2 text-right font-medium">Margin</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/5 text-neutral-300">
								{rows.length > 0 ? (
									rows.map((row: any) => {
										const month = row.month_start as string;
										const revenue = Number(row.revenue ?? 0);
										const expenses = Number(row.expenses ?? 0);
										const net = Number(row.net ?? revenue - expenses);
										const marginPct = revenue > 0 ? (net / revenue) * 100 : 0;
										return (
											<tr key={month} className="group hover:bg-white/5">
												<td className="py-2 text-neutral-400 group-hover:text-neutral-200">
													{new Date(month).toLocaleDateString(undefined, {
														year: "2-digit",
														month: "short",
													})}
												</td>
												<td className="py-2 text-right font-medium text-neutral-50">
													{formatCurrency(net)}
												</td>
												<td
													className={`py-2 text-right ${marginPct >= 20
														? "text-emerald-400"
														: marginPct > 0
															? "text-amber-400"
															: "text-red-400"
														}`}
												>
													{formatPercent(marginPct)}
												</td>
											</tr>
										);
									})
								) : (
									<tr>
										<td colSpan={3} className="py-4 text-center text-neutral-500">
											No data available.
										</td>
									</tr>
								)}
							</tbody>
						</table>
					</div>
				</Card>
			</div>
		</div>
	);
}




