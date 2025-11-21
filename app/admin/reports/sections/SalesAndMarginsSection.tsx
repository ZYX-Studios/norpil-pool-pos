"use client";

import { formatCategoryLabel, formatCurrency, formatPercent } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
	Area,
	AreaChart,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

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
 */
export function SalesAndMarginsSection({
	totalRevenue,
	daily,
	byCategory,
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
			name: formatCategoryLabel(catKey),
			value: revenue,
			share,
			marginPct,
		};
	});

	// Prepare data for the area chart
	const dailyData = (daily ?? []).map((row: any) => ({
		date: new Date(row.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
		revenue: Number(row.revenue ?? 0),
	}));

	// Colors for the pie chart - neutral/emerald palette
	const COLORS = ["#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"];

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Sales &amp; margins
				</h2>
				<p className="mt-1 text-[0.7rem] text-neutral-500">
					See how categories contribute to revenue and profit.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Revenue trend across the date range */}
				<Card className="md:col-span-2">
					<div className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						Revenue trend
					</div>
					<div className="h-64 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={dailyData}>
								<defs>
									<linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
										<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
									</linearGradient>
								</defs>
								<XAxis
									dataKey="date"
									stroke="#525252"
									fontSize={10}
									tickLine={false}
									axisLine={false}
								/>
								<YAxis
									stroke="#525252"
									fontSize={10}
									tickLine={false}
									axisLine={false}
									tickFormatter={(value) => `$${value}`}
								/>
								<Tooltip
									contentStyle={{
										backgroundColor: "#171717",
										borderColor: "#262626",
										color: "#f5f5f5",
										fontSize: "12px",
									}}
									itemStyle={{ color: "#10b981" }}
									formatter={(value: number) => [formatCurrency(value), "Revenue"]}
								/>
								<Area
									type="monotone"
									dataKey="revenue"
									stroke="#10b981"
									fillOpacity={1}
									fill="url(#colorRevenue)"
								/>
							</AreaChart>
						</ResponsiveContainer>
					</div>
				</Card>

				{/* Category mix with margin percentage */}
				<Card>
					<div className="mb-4 text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
						By category
					</div>
					<div className="h-48 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={categoriesWithShare}
									cx="50%"
									cy="50%"
									innerRadius={40}
									outerRadius={70}
									paddingAngle={2}
									dataKey="value"
								>
									{categoriesWithShare.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORS[index % COLORS.length]}
											stroke="rgba(0,0,0,0.2)"
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
					<div className="mt-4 space-y-2">
						{categoriesWithShare.map((row, index) => (
							<div key={row.name} className="flex items-center justify-between text-xs">
								<div className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: COLORS[index % COLORS.length] }}
									/>
									<span className="text-neutral-300">{row.name}</span>
								</div>
								<div className="flex items-center gap-2">
									<span className="text-neutral-500">
										{formatPercent(row.marginPct)} margin
									</span>
									<span className="text-neutral-200">
										{formatCurrency(row.value)}
									</span>
								</div>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}



