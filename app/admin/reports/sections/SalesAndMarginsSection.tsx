import { formatCategoryLabel, formatCurrency, formatPercent } from "../format";

interface SalesAndMarginsSectionProps {
	totalRevenue: number;
	daily: any[];
	byCategory: any[];
	byMethod: any[];
	categoryMargins: any[];
}

/**
 * Sales & margins view.
 *
 * Answers:
 * - Which days in the range are strongest?
 * - Which categories drive revenue and margin?
 * - How is revenue split by payment method?
 */
export function SalesAndMarginsSection({
	totalRevenue,
	daily,
	byCategory,
	byMethod,
	categoryMargins,
}: SalesAndMarginsSectionProps) {
	// Helper lookups for category-level margin %.
	const marginByCategory = new Map<string, number>();
	for (const row of categoryMargins ?? []) {
		const cat = row.category as string;
		const revenueCat = Number(row.revenue ?? 0);
		const margin = Number(row.margin ?? 0);
		const marginPct = revenueCat > 0 ? (margin / revenueCat) * 100 : 0;
		if (cat) marginByCategory.set(cat, marginPct);
	}

	const categoriesWithShare = (byCategory ?? []).map((row: any) => {
		const revenue = Number(row.revenue ?? 0);
		const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
		const catKey = row.category as string;
		const marginPct = marginByCategory.get(catKey) ?? 0;
		return {
			category: catKey,
			revenue,
			share,
			marginPct,
		};
	});

	// Payment method stats.
	const paymentCounts = new Map<string, number>();
	for (const row of byMethod ?? []) {
		const method = row.method as string | null;
		if (!method) continue;
		const existing = paymentCounts.get(method) ?? 0;
		paymentCounts.set(method, existing + (row.count ?? 0));
	}
	const paymentMethodsWithStats = (byMethod ?? []).map((row: any) => {
		const method = row.method as string;
		const revenue = Number(row.revenue ?? 0);
		const share = totalRevenue > 0 ? (revenue / totalRevenue) * 100 : 0;
		const count = paymentCounts.get(method) ?? 0;
		return { method, revenue, share, count };
	});

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Sales &amp; margins
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					See how categories and payment methods contribute to revenue and profit.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Revenue trend across the date range */}
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Revenue trend
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{(daily ?? []).length > 0 ? (
							(daily as any[]).map((row) => {
								const day = row.day as string;
								const amount = Number(row.revenue ?? 0);
								const max =
									Math.max(
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
										<span className="w-20 text-right">
											{formatCurrency(amount)}
										</span>
									</div>
								);
							})
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>

				{/* Category mix with margin percentage */}
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						By category
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{categoriesWithShare.length > 0 ? (
							categoriesWithShare.map((row) => (
								<div
									key={row.category}
									className="flex items-center justify-between gap-2"
								>
									<span>{formatCategoryLabel(row.category)}</span>
									<div className="flex items-center gap-2">
										<span className="text-neutral-400">
											{formatPercent(row.share)}
										</span>
										<span className="text-neutral-500">
											{formatPercent(row.marginPct)} margin
										</span>
										<span>{formatCurrency(row.revenue)}</span>
									</div>
								</div>
							))
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>

				{/* Payment method split */}
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						By payment method
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{paymentMethodsWithStats.length > 0 ? (
							paymentMethodsWithStats.map((row) => (
								<div
									key={row.method}
									className="flex items-center justify-between gap-2"
								>
									<span>{row.method}</span>
									<div className="flex items-center gap-3">
										<span className="text-neutral-400">{row.count} tx</span>
										<span className="text-neutral-400">
											{formatPercent(row.share)}
										</span>
										<span>{formatCurrency(row.revenue)}</span>
									</div>
								</div>
							))
						) : (
							<div className="text-neutral-500">No data.</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}


