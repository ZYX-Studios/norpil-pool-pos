"use client";

import { formatCategoryLabel, formatCurrency, formatPercent } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
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
	hourly: any[]; // New prop
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
	hourly,
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
			name: formatCategoryLabel(catKey),
			value: revenue,
			share,
			marginPct,
		};
	});

	// Prepare data for the area chart (Multi-day)
	const dailyData = (daily ?? []).map((row: any) => ({
		date: new Date(row.day).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
		revenue: Number(row.revenue ?? 0),
	}));

	// Prepare data for hourly chart (Single day)
	const hourlyData = (hourly ?? []).map((row: any) => ({
		hour: row.hour,
		label: `${String(row.hour).padStart(2, '0')}:00`,
		revenue: Number(row.revenue ?? 0),
	}));

	// Determine if we are viewing a single day (approximated by checking if daily data is 1 or 0 rows, 
	// BUT daily RPC returns generate_series for range. If range is 1 day, daily has 1 row.)
	const isSingleDay = dailyData.length <= 1;

	// Colors for the pie chart - vibrant palette
	const COLORS = ["#10b981", "#3b82f6", "#f59e0b", "#ec4899", "#8b5cf6", "#06b6d4"];

	return (
		<div className="space-y-3">
			<div>
				<h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">
					Sales &amp; margins
				</h2>
				<p className="mt-1 text-sm text-neutral-500">
					See how categories contribute to revenue and profit.
				</p>
			</div>
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Revenue trend across the date range OR Hourly breakdown */}
				<Card className="md:col-span-2">
					<div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						{isSingleDay ? "Hourly Sales" : "Revenue trend"}
					</div>
					<div className="h-64 w-full">
						<ResponsiveContainer width="100%" height="100%">
							{isSingleDay ? (
								<BarChart data={hourlyData}>
									<XAxis
										dataKey="label"
										stroke="#525252"
										fontSize={10}
										tickLine={false}
										axisLine={false}
										interval={2} // Show every 3rd hour to avoid crowding
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
											backgroundColor: "#000000",
											borderColor: "#333333",
											color: "#ffffff",
											fontSize: "12px",
											borderRadius: "4px",
											boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
										}}
										cursor={{ fill: "rgba(255,255,255,0.05)" }}
										formatter={(value: number) => [formatCurrency(value), "Revenue"]}
									/>
									<Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
								</BarChart>
							) : (
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
											backgroundColor: "#000000",
											borderColor: "#333333",
											color: "#ffffff",
											fontSize: "12px",
											borderRadius: "4px",
											boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
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
							)}
						</ResponsiveContainer>
					</div>
				</Card>

				{/* Category mix with margin percentage */}
				<Card>
					<div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						By category
					</div>
					<div className="h-48 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={categoriesWithShare}
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
									{categoriesWithShare.map((entry, index) => (
										<Cell
											key={`cell-${index}`}
											fill={COLORS[index % COLORS.length]}
											stroke="none"
										/>
									))}
								</Pie>
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
							</PieChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4 space-y-2">
						{categoriesWithShare.map((row, index) => (
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
			<div className="grid grid-cols-1 gap-4 md:grid-cols-3">
				{/* Revenue by Method - New Addition */}
				<Card>
					<div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
						By Payment
					</div>
					<div className="h-48 w-full">
						<ResponsiveContainer width="100%" height="100%">
							<PieChart>
								<Pie
									data={(byMethod ?? []).map((row: any) => ({
										name: row.method === 'WALLET' ? 'Wallet' : row.method === 'CHARGE_TO_TABLE' ? 'Charge to Table' : 'Other',
										value: Number(row.revenue ?? 0)
									}))}
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
									{(byMethod ?? []).map((entry: any, index: number) => (
										<Cell
											key={`cell-method-${index}`}
											fill={entry.method === 'WALLET' ? '#10b981' : '#f59e0b'}
											stroke="none"
										/>
									))}
								</Pie>
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
							</PieChart>
						</ResponsiveContainer>
					</div>
					<div className="mt-4 space-y-2">
						{(byMethod ?? []).map((row: any, index: number) => (
							<div key={row.method} className="flex items-center justify-between text-sm">
								<div className="flex items-center gap-2">
									<div
										className="h-2 w-2 rounded-full"
										style={{ backgroundColor: row.method === 'WALLET' ? '#10b981' : '#f59e0b' }}
									/>
									<span className="text-neutral-300">
										{row.method === 'WALLET' ? 'Wallet' : 'Charge to Table'}
									</span>
								</div>
								<span className="text-neutral-200">
									{formatCurrency(Number(row.revenue ?? 0))}
								</span>
							</div>
						))}
					</div>
				</Card>
			</div>
		</div>
	);
}




