"use client";

import { formatCurrency, formatPercent, formatDate } from "../format";
import { Card } from "@/app/components/ui/Card";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface MonthlyDetailSectionProps {
    dailyRevenue: any[];
    expenses: any[];
}

/**
 * Monthly detail view.
 *
 * Answers:
 * - How did we perform each day of the month?
 * - Daily breakdown of Revenue, Expenses, and Net Profit.
 */
export function MonthlyDetailSection({ dailyRevenue, expenses }: MonthlyDetailSectionProps) {
    // 1. Aggregate expenses by day
    const expensesByDay = new Map<string, number>();
    for (const exp of expenses ?? []) {
        const date = exp.expense_date; // YYYY-MM-DD
        const amount = Number(exp.amount ?? 0);
        expensesByDay.set(date, (expensesByDay.get(date) ?? 0) + amount);
    }

    // 2. Merge with daily revenue
    const allDates = new Set<string>();
    (dailyRevenue ?? []).forEach((d) => allDates.add(d.day));
    (expenses ?? []).forEach((e) => allDates.add(e.expense_date));

    const sortedDates = Array.from(allDates).sort();

    // Create lookup for revenue
    const revenueByDay = new Map<string, number>();
    (dailyRevenue ?? []).forEach((d) => {
        revenueByDay.set(d.day, Number(d.revenue ?? 0));
    });

    const chartData = sortedDates.map((date) => {
        const revenue = revenueByDay.get(date) ?? 0;
        const expense = expensesByDay.get(date) ?? 0;
        const net = revenue - expense;

        return {
            date,
            displayDate: formatDate(date, { day: "numeric", month: "short" }),
            revenue,
            expenses: expense,
            net,
        };
    });

    return (
        <div className="space-y-3">
            <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">
                    Monthly Detail
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                    Daily breakdown of revenue, expenses, and net profit for the month.
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                <Card className="lg:col-span-2">
                    <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
                        Daily Performance
                    </div>
                    <div className="h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData}>
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="rgba(255,255,255,0.1)"
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="displayDate"
                                    stroke="#a3a3a3"
                                    fontSize={10}
                                    tickLine={false}
                                    axisLine={false}
                                />
                                <YAxis
                                    stroke="#a3a3a3"
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
                                    itemStyle={{ color: "#e5e5e5" }}
                                    formatter={(value: number) => formatCurrency(value)}
                                />
                                <Bar
                                    dataKey="revenue"
                                    name="Revenue"
                                    fill="#10b981" // emerald-500
                                    radius={[4, 4, 0, 0]}
                                    barSize={12}
                                />
                                <Bar
                                    dataKey="expenses"
                                    name="Expenses"
                                    fill="#ef4444" // red-500
                                    radius={[4, 4, 0, 0]}
                                    barSize={12}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="net"
                                    name="Net Profit"
                                    stroke="#f59e0b" // amber-500
                                    strokeWidth={2}
                                    dot={{ r: 2, fill: "#f59e0b" }}
                                />
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                </Card>

                <Card className="lg:col-span-1">
                    <div className="mb-3 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
                        Daily Breakdown
                    </div>
                    <div className="max-h-64 overflow-y-auto pr-2 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10 hover:scrollbar-thumb-white/20">
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-[#0a0a0a] text-left text-neutral-400">
                                <tr>
                                    <th className="pb-2 font-medium">Date</th>
                                    <th className="pb-2 text-right font-medium">Net</th>
                                    <th className="pb-2 text-right font-medium">Margin</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-neutral-300">
                                {chartData.length > 0 ? (
                                    chartData.map((row) => {
                                        const marginPct = row.revenue > 0 ? (row.net / row.revenue) * 100 : 0;
                                        return (
                                            <tr key={row.date} className="group hover:bg-white/5">
                                                <td className="py-2 text-neutral-400 group-hover:text-neutral-200">
                                                    {row.displayDate}
                                                </td>
                                                <td className="py-2 text-right font-medium text-neutral-50">
                                                    {formatCurrency(row.net)}
                                                </td>
                                                <td
                                                    className={`py-2 text-right ${marginPct >= 20
                                                        ? "text-emerald-400"
                                                        : marginPct > 0
                                                            ? "text-amber-400"
                                                            : "text-red-400"
                                                        }`}
                                                >
                                                    {formatPercent(marginPct)}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan={3} className="py-4 text-center text-neutral-500">
                                            No data available.
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
