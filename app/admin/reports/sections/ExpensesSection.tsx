"use client";

import { createExpense } from "../actions";
import { formatCurrency, formatPercent } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";

interface ExpensesSectionProps {
	startDate: string;
	expenses: any[];
}

/**
 * Expenses & cost structure view.
 *
 * Answers:
 * - What operating expenses were recorded in this period?
 * - How are they distributed across categories?
 */
export function ExpensesSection({ startDate, expenses }: ExpensesSectionProps) {
	const expenseArray = expenses ?? [];
	const expensesByCategory = new Map<string, number>();
	let totalExpenses = 0;

	for (const row of expenseArray) {
		const amount = Number(row.amount ?? 0);
		const cat = row.category as string;
		if (!cat) continue;
		expensesByCategory.set(cat, (expensesByCategory.get(cat) ?? 0) + amount);
		totalExpenses += amount;
	}

	const chartData = Array.from(expensesByCategory.entries()).map(([name, value]) => ({
		name,
		value,
		share: totalExpenses > 0 ? (value / totalExpenses) * 100 : 0,
	}));

	// Colors for expenses - warm/neutral palette
	const COLORS = [
		"#f87171", // red-400
		"#fb923c", // orange-400
		"#fbbf24", // amber-400
		"#a3a3a3", // neutral-400
		"#60a5fa", // blue-400
		"#c084fc", // purple-400
		"#f472b6", // pink-400
	];

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Expenses &amp; cost structure
				</h2>
				<p className="mt-1 text-sm text-neutral-500">
					Record operating expenses and see how they roll up into profit.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-1">
					<div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						Add expense
					</div>
					<form action={createExpense} className="space-y-3 text-sm">
						<div className="space-y-1">
							<label className="block text-neutral-300">Date</label>
							<input
								type="date"
								name="expense_date"
								defaultValue={startDate}
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
								required
							/>
						</div>
						<div className="space-y-1">
							<label className="block text-neutral-300">Category</label>
							<select
								name="category"
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
								required
							>
								<option value="">Select category</option>
								<option value="RENTAL">Rental</option>
								<option value="UTILITIES">Utilities (Electricity, Water)</option>
								<option value="MANPOWER">Manpower</option>
								<option value="INVENTORY">Inventory</option>
								<option value="BEVERAGES">Beverages (purchases)</option>
								<option value="CLEANING_MATERIALS">Cleaning materials</option>
								<option value="TRANSPORTATION">Transportation</option>
								<option value="PAYROLL">Payroll</option>
								<option value="MARKETING">Marketing</option>
								<option value="PREDATOR_COMMISSION">
									Predator (table commission)
								</option>
								<option value="OTHER">Other</option>
							</select>
						</div>
						<div className="space-y-1">
							<label className="block text-neutral-300">Amount</label>
							<input
								type="number"
								name="amount"
								min="0"
								step="0.01"
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
								required
							/>
						</div>
						<div className="space-y-1">
							<label className="block text-neutral-300">Note (optional)</label>
							<textarea
								name="note"
								rows={2}
								className="w-full resize-none rounded border border-white/10 bg-black/40 px-3 py-2 text-sm text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
								placeholder="Short description..."
							/>
						</div>
						<button
							type="submit"
							className="mt-1 w-full rounded-full bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200 transition-colors"
						>
							Save expense
						</button>
					</form>
				</Card>

				<Card className="lg:col-span-2">
					<div className="mb-3 flex items-center justify-between text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						<span>Expenses breakdown</span>
					</div>
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
						<div className="h-48 w-full">
							<ResponsiveContainer width="100%" height="100%">
								<PieChart>
									<Pie
										data={chartData}
										cx="50%"
										cy="50%"
										innerRadius={60}
										outerRadius={80}
										paddingAngle={2}
										dataKey="value"
										startAngle={90}
										endAngle={-270}
										stroke="none"
									>
										{chartData.map((entry, index) => (
											<Cell
												key={`cell-${index}`}
												fill={COLORS[index % COLORS.length]}
												stroke="none"
											/>
										))}
									</Pie>
									<Tooltip
										contentStyle={{
											backgroundColor: "#171717",
											borderColor: "#262626",
											color: "#f5f5f5",
											fontSize: "12px",
										}}
										formatter={(value: number) => formatCurrency(value)}
									/>
								</PieChart>
							</ResponsiveContainer>
						</div>
						<div className="space-y-2">
							{chartData.length > 0 ? (
								chartData.map((row, index) => (
									<div key={row.name} className="flex items-center justify-between text-sm">
										<div className="flex items-center gap-2">
											<div
												className="h-2 w-2 rounded-full"
												style={{ backgroundColor: COLORS[index % COLORS.length] }}
											/>
											<span className="text-neutral-300">{row.name}</span>
										</div>
										<div className="flex items-center gap-2">
											<span className="text-neutral-500">
												{formatPercent(row.share)}
											</span>
											<span className="text-neutral-200">
												{formatCurrency(row.value)}
											</span>
										</div>
									</div>
								))
							) : (
								<div className="text-neutral-500">No expenses recorded.</div>
							)}
						</div>
					</div>

					<div className="mt-6 border-t border-white/5 pt-4">
						<div className="mb-2 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
							Recent entries
						</div>
						<div className="max-h-40 overflow-y-auto space-y-1 text-sm text-neutral-200 pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
							{expenseArray.length > 0 ? (
								expenseArray.map((row: any) => (
									<div
										key={row.id}
										className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white/5"
									>
										<span className="text-neutral-400 w-20">
											{new Date(row.expense_date as string).toLocaleDateString()}
										</span>
										<span className="flex-1 truncate px-2">
											{row.category as string}
											{row.note ? ` – ${row.note}` : ""}
										</span>
										<span>{formatCurrency(Number(row.amount ?? 0))}</span>
									</div>
								))
							) : (
								<div className="text-neutral-500">No expenses in this range.</div>
							)}
						</div>
					</div>
				</Card>
			</div>
		</div>
	);
}




