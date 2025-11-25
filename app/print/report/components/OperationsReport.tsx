import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency } from "../../../admin/reports/format";

interface OperationsReportProps {
    data: ReportData;
}

export function OperationsReport({ data }: OperationsReportProps) {
    const byTable = data.byTable ?? [];
    const transactions = data.tx ?? [];

    // Top 10 Transactions
    const topTransactions = [...transactions]
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 10);

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Operations Report
            </h2>

            <div className="grid grid-cols-2 gap-8">
                {/* Revenue by Table */}
                <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Revenue by Table</h3>
                    <table className="w-full text-sm text-left border border-neutral-200">
                        <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 font-medium">Table Name</th>
                                <th className="px-4 py-3 font-medium text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {byTable.map((table: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                    <td className="px-4 py-3 text-neutral-800">{table.table_name}</td>
                                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                                        {formatCurrency(Number(table.revenue))}
                                    </td>
                                </tr>
                            ))}
                            {byTable.length === 0 && (
                                <tr>
                                    <td colSpan={2} className="px-4 py-3 text-center text-neutral-500">No table data available</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Top Transactions */}
                <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Top 10 Highest Transactions</h3>
                    <table className="w-full text-sm text-left border border-neutral-200">
                        <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 font-medium">Date</th>
                                <th className="px-4 py-3 font-medium">Method</th>
                                <th className="px-4 py-3 font-medium text-right">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {topTransactions.map((tx: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                    <td className="px-4 py-3 text-neutral-600">
                                        {new Date(tx.paid_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-4 py-3 text-neutral-600 capitalize">{tx.method}</td>
                                    <td className="px-4 py-3 text-right font-medium text-neutral-900">
                                        {formatCurrency(Number(tx.amount))}
                                    </td>
                                </tr>
                            ))}
                            {topTransactions.length === 0 && (
                                <tr>
                                    <td colSpan={3} className="px-4 py-3 text-center text-neutral-500">No transactions found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
