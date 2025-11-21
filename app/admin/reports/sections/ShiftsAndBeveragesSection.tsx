import { formatCurrency, formatPercent } from "../format";

interface ShiftsAndBeveragesSectionProps {
	byShift: any[];
	drinkMargins: any[];
}

/**
 * Shifts & beverages view.
 *
 * Answers:
 * - How does day shift compare to night shift?
 * - How much do alcoholic vs non‑alcoholic drinks contribute, and at what margin?
 */
export function ShiftsAndBeveragesSection({
	byShift,
	drinkMargins,
}: ShiftsAndBeveragesSectionProps) {
	const shiftsWithRevenue = (byShift ?? []).map((row: any) => ({
		name: (row.shift_name as string) ?? "Unknown",
		revenue: Number(row.revenue ?? 0),
	}));

	const drinkTypeArray = (drinkMargins as any[] | null) ?? [];
	const totalDrinkRevenue = drinkTypeArray.reduce(
		(sum, row) => sum + Number(row.revenue ?? 0),
		0,
	);
	const drinkTypesWithShare = drinkTypeArray.map((row: any) => {
		const revenue = Number(row.revenue ?? 0);
		const share = totalDrinkRevenue > 0 ? (revenue / totalDrinkRevenue) * 100 : 0;
		const margin = Number(row.margin ?? 0);
		const marginPct = revenue > 0 ? (margin / revenue) * 100 : 0;
		const label = row.is_alcoholic ? "Alcoholic beverages" : "Non‑alcoholic beverages";
		return { label, revenue, share, marginPct };
	});

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Shifts &amp; beverages
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					Compare day vs night sales and the role of alcoholic vs non‑alcoholic drinks.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						By shift (10:00–18:00 vs night)
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{shiftsWithRevenue.length > 0 ? (
							shiftsWithRevenue.map((row) => (
								<div
									key={row.name}
									className="flex items-center justify-between gap-2"
								>
									<span>{row.name}</span>
									<span>{formatCurrency(row.revenue)}</span>
								</div>
							))
						) : (
							<div className="text-neutral-500">No shift data.</div>
						)}
					</div>
				</div>
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Beverages: alcoholic vs non‑alcoholic
					</div>
					<div className="space-y-1 text-xs text-neutral-200">
						{drinkTypesWithShare.length > 0 ? (
							drinkTypesWithShare.map((row) => (
								<div
									key={row.label}
									className="flex items-center justify-between gap-2"
								>
									<span>{row.label}</span>
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
							<div className="text-neutral-500">No beverage data.</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}


