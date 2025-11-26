"use client";

import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency, formatPercent } from "../../../admin/reports/format";
import {
    Bar,
    CartesianGrid,
    ComposedChart,
    Line,
    ResponsiveContainer,
    XAxis,
    YAxis,
} from "recharts";

interface FinancialSnapshotProps {
    data: ReportData;
}

export function FinancialSnapshot({ data }: FinancialSnapshotProps) {
    const totalRevenue = Number(data.total ?? 0);
    const txArray = data.tx ?? [];
    const totalTransactions = txArray.length;
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    const expenseArray = data.expenses ?? [];
    let totalExpenses = 0;
    for (const row of expenseArray) {
        totalExpenses += Number(row.amount ?? 0);
    }
    const netProfit = totalRevenue - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Prepare Chart Data (Monthly or Daily depending on range)
    // For simplicity in this snapshot, we'll use the daily data if available, or monthly
    const dailyData = data.daily ?? [];
    const chartData = dailyData.map((d: any) => ({
        date: new Date(d.day).toLocaleDateString(undefined, { day: "numeric", month: "short" }),
        revenue: Number(d.revenue),
    }));

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Financial Snapshot
            </h2>

            <div className="grid grid-cols-3 gap-6 mb-12">
                <MetricBox label="Gross Sales" value={formatCurrency(totalRevenue)} />
                <MetricBox label="Total Transactions" value={totalTransactions.toString()} />
                <MetricBox label="Average Ticket" value={formatCurrency(averageTicket)} />
                <MetricBox label="Total Expenses" value={formatCurrency(totalExpenses)} isNegative />
                <MetricBox
                    label="Net Profit"
                    value={formatCurrency(netProfit)}
                    color={netProfit >= 0 ? "text-emerald-700" : "text-red-700"}
                />
                <MetricBox
                    label="Net Margin"
                    value={formatPercent(netMargin)}
                    color={netMargin >= 20 ? "text-emerald-700" : "text-amber-700"}
                />
            </div>
            <div className="h-96 w-full border border-neutral-200 rounded-lg p-4 bg-white">
                <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Revenue Trend</h3>
                <div className="flex justify-center">
                    <ComposedChart width={600} height={350} data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                        <XAxis
                            dataKey="date"
                            stroke="#737373"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#737373"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `₱${val}`}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" barSize={20} radius={[4, 4, 0, 0]} isAnimationActive={false} />
                        <Line type="monotone" dataKey="revenue" stroke="#2563eb" strokeWidth={2} dot={false} isAnimationActive={false} />
                    </ComposedChart>
                </div>
            </div>
        </div >

    );
}

function MetricBox({ label, value, isNegative, color }: { label: string; value: string; isNegative?: boolean; color?: string }) {
    return (
        <div className="p-6 border border-neutral-200 rounded-lg bg-neutral-50">
            <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">{label}</div>
            <div className={`text-2xl font-bold ${color ? color : isNegative ? "text-red-600" : "text-neutral-900"}`}>
                {value}
            </div>
        </div>
    );
}
