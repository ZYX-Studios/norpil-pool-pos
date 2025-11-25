import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency, formatPercent } from "../../../admin/reports/format";

interface DailyBreakdownProps {
    data: ReportData;
}

export function DailyBreakdown({ data }: DailyBreakdownProps) {
    const daily = data.daily ?? [];
    const expenses = data.expenses ?? [];

    // Merge expenses into daily data for net calc
    // Note: This is a simplified merge. Ideally we'd group expenses by date first.
    const expensesByDate = expenses.reduce((acc: Record<string, number>, curr: any) => {
        const date = curr.expense_date ? curr.expense_date.split("T")[0] : "";
        if (date) {
            acc[date] = (acc[date] || 0) + Number(curr.amount);
        }
        return acc;
    }, {});

    const rows = daily.map((day: any) => {
        // The RPC returns 'day' not 'date'
        const dateRaw = day.day || day.date;
        const dateStr = dateRaw ? dateRaw.split("T")[0] : "";
        const revenue = Number(day.revenue);
        const expense = expensesByDate[dateStr] || 0;
        const net = revenue - expense;
        const margin = revenue > 0 ? (net / revenue) * 100 : 0;
        return {
            date: dateRaw,
            revenue,
            expense,
            net,
            margin
        };
    });

    // Sort by date desc
    rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Daily Breakdown
            </h2>

            <div className="overflow-hidden border border-neutral-200 rounded-lg">
                <table className="w-full text-sm text-left">
                    <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                        <tr>
                            <th className="px-4 py-3 font-medium">Date</th>
                            <th className="px-4 py-3 font-medium text-right">Gross Sales</th>
                            <th className="px-4 py-3 font-medium text-right">Expenses</th>
                            <th className="px-4 py-3 font-medium text-right">Net Profit</th>
                            <th className="px-4 py-3 font-medium text-right">Margin</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-200">
                        {rows.map((row, idx) => (
                            <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                <td className="px-4 py-3 text-neutral-800 font-medium">
                                    {new Date(row.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                </td>
                                <td className="px-4 py-3 text-right text-neutral-600">{formatCurrency(row.revenue)}</td>
                                <td className="px-4 py-3 text-right text-red-600">{row.expense > 0 ? `(${formatCurrency(row.expense)})` : "-"}</td>
                                <td className={`px-4 py-3 text-right font-bold ${row.net >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                    {formatCurrency(row.net)}
                                </td>
                                <td className={`px-4 py-3 text-right ${row.margin >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                                    {formatPercent(row.margin)}
                                </td>
                            </tr>
                        ))}
                        {rows.length === 0 && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">No daily data available for this period.</td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
