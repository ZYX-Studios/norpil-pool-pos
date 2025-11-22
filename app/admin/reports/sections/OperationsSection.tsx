import { formatCurrency } from "../format";
import { Card } from "@/app/components/ui/Card";

interface OperationsSectionProps {
	byTable: any[];
	transactions: any[];
}

/**
 * Operations view.
 *
 * Answers:
 * - Which tables generate the most revenue?
 * - Detailed transaction log for auditing.
 */
export function OperationsSection({ byTable, transactions }: OperationsSectionProps) {
	const tableRevenue = (byTable ?? []).map((row: any) => ({
		name: (row.table_name as string) ?? "Unknown",
		revenue: Number(row.revenue ?? 0),
	}));

	const txList = (transactions ?? []).map((t: any) => {
		const order = t.orders;
		const tableSession = order?.table_sessions;
		const poolTable = tableSession?.pool_tables;
		const tableName = poolTable?.name ?? "Unknown Table";

		return {
			id: t.id,
			time: new Date(t.paid_at).toLocaleTimeString(undefined, {
				hour: "2-digit",
				minute: "2-digit",
			}),
			method: t.method,
			amount: Number(t.amount ?? 0),
			tableName,
		};
	});

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Operations
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Table performance and transaction audit log.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
				<Card className="lg:col-span-1">
					<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Revenue by table
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{tableRevenue.length > 0 ? (
							tableRevenue.map((row) => (
								<div
									key={row.name}
									className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-white/5"
								>
									<span>{row.name}</span>
									<span className="font-medium">{formatCurrency(row.revenue)}</span>
								</div>
							))
						) : (
							<div className="text-neutral-500">No table data.</div>
						)}
					</div>
				</Card>

				<Card className="lg:col-span-2">
					<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Recent transactions
					</div>
					<div className="max-h-[400px] overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
						<table className="w-full text-left text-xs">
							<thead className="sticky top-0 bg-[#0a0a0a] text-neutral-400">
								<tr>
									<th className="pb-2 font-medium">Time</th>
									<th className="pb-2 font-medium">Table</th>
									<th className="pb-2 font-medium">Method</th>
									<th className="pb-2 text-right font-medium">Amount</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-white/5 text-neutral-300">
								{txList.length > 0 ? (
									txList.map((tx) => (
										<tr key={tx.id} className="group hover:bg-white/5">
											<td className="py-2 text-neutral-500 group-hover:text-neutral-300">
												{tx.time}
											</td>
											<td className="py-2">{tx.tableName}</td>
											<td className="py-2">
												<span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-neutral-400">
													{tx.method}
												</span>
											</td>
											<td className="py-2 text-right font-medium text-neutral-50">
												{formatCurrency(tx.amount)}
											</td>
										</tr>
									))
								) : (
									<tr>
										<td colSpan={4} className="py-4 text-center text-neutral-500">
											No transactions found.
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


