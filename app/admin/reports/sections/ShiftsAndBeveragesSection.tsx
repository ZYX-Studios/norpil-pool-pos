"use client";

import { formatCurrency, formatPercent } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
	Bar,
	BarChart,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

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
		const label = row.is_alcoholic ? "Alcoholic" : "Non‑alcoholic";

		return {
			name: label,
			revenue,
			share,
			margin,
			marginPct,
		};
	});

	return (
		<div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<Card>
				<div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
					Revenue by Shift
				</div>
				<div className="h-48 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={shiftsWithRevenue} layout="vertical">
							<XAxis type="number" hide />
							<YAxis
								dataKey="name"
								type="category"
								stroke="#a3a3a3"
								fontSize={11}
								tickLine={false}
								axisLine={false}
								width={80}
							/>
							<Tooltip
								cursor={{ fill: "rgba(255,255,255,0.05)" }}
								contentStyle={{
									backgroundColor: "#171717",
									borderColor: "#262626",
									color: "#f5f5f5",
									fontSize: "12px",
								}}
								formatter={(value: number) => formatCurrency(value)}
							/>
							<Bar dataKey="revenue" fill="#10b981" radius={[0, 4, 4, 0]} barSize={20} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</Card>

			<Card>
				<div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
					Beverages: Alcoholic vs Non‑alcoholic
				</div>
				<div className="h-48 w-full">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={drinkTypesWithShare}>
							<XAxis
								dataKey="name"
								stroke="#a3a3a3"
								fontSize={11}
								tickLine={false}
								axisLine={false}
							/>
							<YAxis hide />
							<Tooltip
								cursor={{ fill: "rgba(255,255,255,0.05)" }}
								contentStyle={{
									backgroundColor: "#171717",
									borderColor: "#262626",
									color: "#f5f5f5",
									fontSize: "12px",
								}}
								formatter={(value: number) => formatCurrency(value)}
							/>
							<Bar dataKey="revenue" fill="#34d399" radius={[4, 4, 0, 0]} barSize={40}>
								{drinkTypesWithShare.map((entry, index) => (
									<Cell
										key={`cell-${index}`}
										fill={entry.name === "Alcoholic" ? "#10b981" : "#6ee7b7"}
									/>
								))}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
				<div className="mt-2 flex justify-center gap-4 text-sm text-neutral-400">
					{drinkTypesWithShare.map((item) => (
						<div key={item.name} className="flex items-center gap-1">
							<div
								className="h-2 w-2 rounded-full"
								style={{
									backgroundColor: item.name === "Alcoholic" ? "#10b981" : "#6ee7b7",
								}}
							/>
							<span>
								{item.name} ({formatPercent(item.share)})
							</span>
						</div>
					))}
				</div>
			</Card>
		</div>
	);
}




