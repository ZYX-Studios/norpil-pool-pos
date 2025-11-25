import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency, formatPercent } from "../../../admin/reports/format";

interface ExecutiveSummaryProps {
    data: ReportData;
    start: string;
    end: string;
}

export function ExecutiveSummary({ data, start, end }: ExecutiveSummaryProps) {
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

    // Narrative Generation
    const salesNarrative = `For the period ${new Date(start).toLocaleDateString()} to ${new Date(end).toLocaleDateString()}, total gross sales reached ${formatCurrency(totalRevenue)}.`;

    const profitNarrative = `Net profit closed at ${formatCurrency(netProfit)} with a net margin of ${formatPercent(netMargin)}. Total expenses for the period were ${formatCurrency(totalExpenses)}.`;

    const opsNarrative = `The business processed ${totalTransactions} transactions with an average ticket of ${formatCurrency(averageTicket)}.`;

    // Determine top category
    const byCategory = data.byCategory ?? [];
    const topCategory = byCategory.length > 0 ? byCategory[0] : null;
    const topCategoryNarrative = topCategory
        ? `The highest contributing category was ${topCategory.category} with ${formatCurrency(topCategory.revenue)} in sales.`
        : "";

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Executive Summary
            </h2>

            <div className="space-y-8 text-neutral-700 leading-relaxed">
                <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-100">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-3">Sales Performance</h3>
                    <p>{salesNarrative}</p>
                </div>

                <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-100">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-3">Profitability</h3>
                    <p>{profitNarrative}</p>
                </div>

                <div className="bg-neutral-50 p-6 rounded-lg border border-neutral-100">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-3">Operational Highlights</h3>
                    <p>{opsNarrative}</p>
                    <p className="mt-2">{topCategoryNarrative}</p>
                </div>

                <div className="mt-8">
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Key Metrics at a Glance</h3>
                    <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 border border-neutral-200 rounded text-center">
                            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Gross Sales</div>
                            <div className="text-xl font-bold text-neutral-900">{formatCurrency(totalRevenue)}</div>
                        </div>
                        <div className="p-4 border border-neutral-200 rounded text-center">
                            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Net Profit</div>
                            <div className={`text-xl font-bold ${netProfit >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                {formatCurrency(netProfit)}
                            </div>
                        </div>
                        <div className="p-4 border border-neutral-200 rounded text-center">
                            <div className="text-xs text-neutral-500 uppercase tracking-wider mb-1">Net Margin</div>
                            <div className={`text-xl font-bold ${netMargin >= 20 ? "text-emerald-600" : "text-amber-600"}`}>
                                {formatPercent(netMargin)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
