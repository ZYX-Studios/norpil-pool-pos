import { formatCurrency } from "../format";

interface OperationsSectionProps {
	byTable: any[];
	transactions: any[];
}

/**
 * Operational view: table performance and transaction-level feed.
 *
 * Answers:
 * - Which tables are generating the most revenue and sessions?
 * - What individual payments happened in the selected period?
 */
export function OperationsSection({ byTable, transactions }: OperationsSectionProps) {
	const tables = byTable ?? [];
	const tx = transactions ?? [];

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Operations
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Table performance and transaction-level detail for audits and coaching.
				</p>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
					Table performance
				</div>
				<div className="max-h-56 overflow-auto">
					<table className="w-full text-xs text-neutral-200">
						<thead className="text-left text-neutral-400">
							<tr>
								<th className="py-1">Table</th>
								<th className="text-right">Sessions</th>
								<th className="text-right">Revenue</th>
							</tr>
						</thead>
						<tbody>
							{tables.length > 0 ? (
								tables.map((row: any) => (
									<tr key={row.table_name}>
										<td className="py-1">{row.table_name}</td>
										<td className="text-right">{row.session_count}</td>
										<td className="text-right">
											{formatCurrency(Number(row.revenue ?? 0))}
										</td>
									</tr>
								))
							) : (
								<tr>
									<td colSpan={3} className="py-3 text-center text-neutral-500">
										No table data in this range.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
					Transactions
				</div>
				<div className="max-h-72 overflow-auto">
					<table className="w-full text-xs text-neutral-200">
						<thead className="text-left text-neutral-400">
							<tr>
								<th className="py-1">When</th>
								<th>Table</th>
								<th>Method</th>
								<th className="text-right">Amount</th>
							</tr>
						</thead>
						<tbody>
							{tx.length > 0 ? (
								tx.map((row: any) => {
									const order = row.orders;
									const session = order?.table_sessions;
									const table = session?.pool_tables;
									const tableName = table?.name ?? "Unknown";
									const paidAt = row.paid_at ? new Date(row.paid_at as string) : null;
									const timeStr = paidAt
										? `${paidAt.toLocaleDateString()} ${paidAt.toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
										  })}`
										: "-";
									return (
										<tr key={row.id}>
											<td className="py-1">{timeStr}</td>
											<td>{tableName}</td>
											<td>{row.method}</td>
											<td className="text-right">
												{formatCurrency(Number(row.amount))}
											</td>
										</tr>
									);
								})
							) : (
								<tr>
									<td colSpan={4} className="py-3 text-center text-neutral-500">
										No transactions in this range.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}


