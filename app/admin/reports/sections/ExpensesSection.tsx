import { createExpense } from "../actions";
import { formatCurrency } from "../format";

interface ExpensesSectionProps {
	startDate: string;
	expenses: any[];
}

/**
 * Expenses & cost structure view.
 *
 * Answers:
 * - What operating expenses were recorded in this period?
 * - How are they distributed across categories (rent, utilities, manpower, etc.)?
 */
export function ExpensesSection({ startDate, expenses }: ExpensesSectionProps) {
	const expenseArray = expenses ?? [];
	const expensesByCategory = new Map<string, number>();
	for (const row of expenseArray) {
		const amount = Number(row.amount ?? 0);
		const cat = row.category as string;
		if (!cat) continue;
		expensesByCategory.set(cat, (expensesByCategory.get(cat) ?? 0) + amount);
	}

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Expenses &amp; cost structure
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Record operating expenses and see how they roll up into profit.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur lg:col-span-1">
					<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Add expense
					</div>
					<form action={createExpense} className="space-y-3 text-xs">
						<div className="space-y-1">
							<label className="block text-neutral-300">Date</label>
							<input
								type="date"
								name="expense_date"
								defaultValue={startDate}
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
								required
							/>
						</div>
						<div className="space-y-1">
							<label className="block text-neutral-300">Category</label>
							<select
								name="category"
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
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
								className="w-full rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
								required
							/>
						</div>
						<div className="space-y-1">
							<label className="block text-neutral-300">Note (optional)</label>
							<textarea
								name="note"
								rows={2}
								className="w-full resize-none rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50"
								placeholder="Short description (e.g. January rent, new stock, marketing campaign)..."
							/>
						</div>
						<button
							type="submit"
							className="mt-1 w-full rounded-full bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-200"
						>
							Save expense
						</button>
					</form>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur lg:col-span-2">
					<div className="mb-3 flex items-center justify-between text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						<span>Expenses in range</span>
						<span className="text-[0.6rem] uppercase text-neutral-500">
							By category
						</span>
					</div>
					<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
						<div className="space-y-1 text-xs text-neutral-200">
							{expenseArray.length > 0 ? (
								expenseArray.map((row: any) => (
									<div
										key={row.id}
										className="flex items-center justify-between gap-2"
									>
										<span className="text-neutral-400">
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
						<div className="space-y-1 text-xs text-neutral-200">
							{Array.from(expensesByCategory.entries()).length > 0 ? (
								Array.from(expensesByCategory.entries()).map(
									([cat, amount]) => (
										<div
											key={cat}
											className="flex items-center justify-between gap-2"
										>
											<span>{cat}</span>
											<span>{formatCurrency(amount)}</span>
										</div>
									),
								)
							) : (
								<div className="text-neutral-500">
									No category breakdown available.
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}


