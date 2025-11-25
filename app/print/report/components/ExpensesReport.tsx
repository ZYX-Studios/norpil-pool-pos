"use client";

import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency } from "../../../admin/reports/format";
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    Legend
} from "recharts";

interface ExpensesReportProps {
    data: ReportData;
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#06b6d4", "#6366f1"];

export function ExpensesReport({ data }: ExpensesReportProps) {
    const expenses = data.expenses ?? [];
    const totalExpenses = expenses.reduce((sum, exp) => sum + Number(exp.amount), 0);

    // Group by Category
    const byCategory = expenses.reduce((acc: Record<string, number>, curr: any) => {
        acc[curr.category] = (acc[curr.category] || 0) + Number(curr.amount);
        return acc;
    }, {});

    const categoryData = Object.entries(byCategory).map(([name, value]) => ({
        name,
        value: value as number,
    })).sort((a, b) => b.value - a.value);

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Expenses Report
            </h2>

            <div className="grid grid-cols-2 gap-8 mb-8">
                {/* Summary Box */}
                <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-6 flex flex-col justify-center items-center text-center">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-2">Total Expenses</h3>
                    <div className="text-4xl font-bold text-red-600">{formatCurrency(totalExpenses)}</div>
                    <div className="text-sm text-neutral-500 mt-2">{expenses.length} records found</div>
                </div>

                {/* Chart */}
                <div className="bg-white border border-neutral-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-4">Expenses by Category</h3>
                    <div className="h-48">
                        <div className="flex justify-center">
                            <PieChart width={300} height={200}>
                                <Pie
                                    data={categoryData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={60}
                                    paddingAngle={categoryData.length > 1 ? 5 : 0}
                                    dataKey="value"
                                    startAngle={0}
                                    endAngle={360}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Legend />
                            </PieChart>
                        </div>
                    </div>
                </div>
            </div>

            {/* Itemized Log */}
            <div>
                <h3 className="text-lg font-semibold text-neutral-900 mb-4">Itemized Expense Log</h3>
                <div className="overflow-hidden border border-neutral-200 rounded-lg">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Category</th>
                                <th className="px-4 py-3 font-medium">Note</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {expenses.map((exp: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                    <td className="px-4 py-3 text-neutral-600">
                                        {new Date(exp.expense_date).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-800 font-medium">{exp.category}</td>
                                    <td className="px-4 py-3 text-neutral-500 italic">{exp.note || "-"}</td>
                                    <td className="px-4 py-3 text-right font-medium text-red-600">
                                        {formatCurrency(Number(exp.amount))}
                                    </td>
                                </tr>
                            ))}
                            {expenses.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-center text-neutral-500">No expenses recorded</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
