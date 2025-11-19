export const dynamic = 'force-dynamic';
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Small helpers stay at the top so the main component reads like a story.
// We keep them generic so they can be reused from other reporting views later.
function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}

function formatPercent(n: number) {
	return `${n.toFixed(1)}%`;
}

function getTodayRange() {
	const now = new Date();
	const yyyy = now.getFullYear();
	const mm = String(now.getMonth() + 1).padStart(2, "0");
	const dd = String(now.getDate()).padStart(2, "0");
	const today = `${yyyy}-${mm}-${dd}`;
	return { start: today, end: today };
}

// The reports page is intentionally kept as a thin server component:
// - Fetch and shape all the data for the selected date range
// - Derive simple aggregates for decision‑making (KPIs, mixes, trends)
// - Render mostly-static markup so the client stays light
export default async function ReportsPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[]>>;
}) {
	const supabase = createSupabaseServerClient();
	const { start: todayStart, end: todayEnd } = getTodayRange();
	const sp = await searchParams;
	const start = (sp?.start as string) ?? todayStart;
	const end = (sp?.end as string) ?? todayEnd;

	// Compute end-exclusive date for range filtering (end + 1 day)
	const endDate = new Date(end);
	endDate.setDate(endDate.getDate() + 1);
	const endExclusive = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, "0")}-${String(
		endDate.getDate(),
	).padStart(2, "0")}`;

	const [{ data: total }, { data: byCategory }, { data: byMethod }, { data: tx }, { data: daily }, { data: byTable }] =
		await Promise.all([
			// High-level revenue aggregates and breakdowns
			supabase.rpc("total_revenue", { p_start: start, p_end: end }),
			supabase.rpc("revenue_by_category", { p_start: start, p_end: end }),
			supabase.rpc("revenue_by_method", { p_start: start, p_end: end }),
			// Raw payment records in the range; used for transaction list and counts
			supabase
				.from("payments")
				.select(
					"id, amount, method, paid_at, orders:order_id(id, total, table_sessions:table_session_id(id, pool_tables:pool_table_id(name)))",
				)
				.gte("paid_at", start)
				.lt("paid_at", endExclusive)
				.order("paid_at", { ascending: false }),
			// Simple trend and table‑level summaries from SQL helpers
			supabase.rpc("daily_revenue", { p_start: start, p_end: end }),
			supabase.rpc("revenue_by_table", { p_start: start, p_end: end }),
		]);

	// Ensure we always work with concrete arrays/numbers so the JSX stays clean.
	const totalRevenue = Number(total ?? 0);
	const txArray = (tx as any[] | null) ?? [];
	const totalTransactions = txArray.length;
	const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

	// Build a quick lookup for how many payments used each method (for counts in UI).
	const paymentCounts = new Map<string, number>();
	for (const row of txArray) {
		const method = row.method as string | null;
		if (!method) continue;
		paymentCounts.set(method, (paymentCounts.get(method) ?? 0) + 1);
	}

	// Attach simple percentage and count to each payment method row.
	const paymentMethodsWithStats = (byMethod ?? []).map((row: any) => {
		const revenue = Number(row.revenue ?? 0);
		const count = paymentCounts.get(row.method) ?? 0;
		const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
		return {
			method: row.method as string,
			revenue,
			count,
			share,
		};
	});

	// Pre-compute category shares so we can quickly see mix in the UI.
	const categoriesWithShare = (byCategory ?? []).map((row: any) => {
		const revenue = Number(row.revenue ?? 0);
		const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
		return {
			category: row.category as string,
			revenue,
			share,
		};
	});

	return (
		<div className="space-y-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">Daily Reports</h1>
					<p className="text-xs text-neutral-400">Track revenue by date range, category, and payment method.</p>
				</div>
			</div>

			<form className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<div className="flex flex-wrap items-end gap-3">
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

			{/* KPI row – gives quick answers for "How are we doing?" */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">Total revenue</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">{formatCurrency(totalRevenue)}</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">Total transactions</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">{totalTransactions}</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="text-xs uppercase tracking-[0.18em] text-neutral-400">Average ticket</div>
					<div className="mt-2 text-2xl font-semibold text-neutral-50">{formatCurrency(averageTicket)}</div>
				</div>
			</div>

			{/* Breakdown row – trends, category mix, and payment mix for decisions */}
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Revenue trend</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{(daily ?? []).length > 0 ? (
							(daily as any[]).map((row) => {
								const day = row.day as string;
								const amount = Number(row.revenue ?? 0);
								// Simple bar width based on max daily revenue in the range
								const max = Math.max(
									...((daily as any[]).map((d) => Number(d.revenue ?? 0)) ?? [1]),
								) || 1;
								const widthPercent = (amount / max) * 100;
								return (
									<div key={day} className="flex items-center gap-2">
										<span className="w-20 text-neutral-400">
											{new Date(day).toLocaleDateString()}
										</span>
										<div className="flex-1 rounded-full bg-white/10">
											<div
												className="h-2 rounded-full bg-emerald-400"
												style={{ width: `${widthPercent}%` }}
											/>
										</div>
										<span className="w-20 text-right">{formatCurrency(amount)}</span>
									</div>
								);
							})
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">By category</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{categoriesWithShare.length > 0 ? (
							categoriesWithShare.map(
								(row: { category: string; revenue: number; share: number }) => (
									<div key={row.category} className="flex items-center justify-between gap-2">
										<span>{row.category}</span>
										<div className="flex items-center gap-2">
											<span className="text-neutral-400">{formatPercent(row.share)}</span>
											<span>{formatCurrency(row.revenue)}</span>
										</div>
									</div>
								),
							)
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						By payment method
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{paymentMethodsWithStats.length > 0 ? (
							paymentMethodsWithStats.map(
								(row: { method: string; revenue: number; count: number; share: number }) => (
									<div key={row.method} className="flex items-center justify-between gap-2">
										<span>{row.method}</span>
										<div className="flex items-center gap-3">
											<span className="text-neutral-400">
												{row.count} tx
											</span>
											<span className="text-neutral-400">{formatPercent(row.share)}</span>
											<span>{formatCurrency(row.revenue)}</span>
										</div>
									</div>
								),
							)
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>
			</div>

			{/* Table performance – helps understand which tables drive revenue */}
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
							{(byTable as any[] | null) && (byTable as any[]).length > 0 ? (
								(byTable as any[]).map((row) => (
									<tr key={row.table_name}>
										<td className="py-1">{row.table_name}</td>
										<td className="text-right">{row.session_count}</td>
										<td className="text-right">{formatCurrency(Number(row.revenue ?? 0))}</td>
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
				<div className="mb-3 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Transactions</div>
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
							{(tx as any[] | null) && (tx as any[]).length > 0 ? (
								(tx as any[]).map((row) => {
									const order = row.orders;
									const session = order?.table_sessions;
									const table = session?.pool_tables;
									const tableName = table?.name ?? "Unknown";
									const paidAt = row.paid_at ? new Date(row.paid_at as string) : null;
									const timeStr = paidAt
										? `${paidAt.toLocaleDateString()} ${paidAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
										: "-";
									return (
										<tr key={row.id}>
											<td className="py-1">{timeStr}</td>
											<td>{tableName}</td>
											<td>{row.method}</td>
											<td className="text-right">{formatCurrency(Number(row.amount))}</td>
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


