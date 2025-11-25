import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency } from "../../../admin/reports/format";

interface AppendixProps {
    data: ReportData;
}

export function Appendix({ data }: AppendixProps) {
    const byCategory = data.byCategory ?? [];
    const byShift = data.byShift ?? [];

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Appendix: Raw Data
            </h2>

            <div className="space-y-8">
                {/* Category Data */}
                <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Revenue by Category</h3>
                    <table className="w-full text-sm text-left border border-neutral-200">
                        <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-2 font-medium">Category</th>
                                <th className="px-4 py-2 font-medium text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {byCategory.map((cat: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                    <td className="px-4 py-2 text-neutral-800">{cat.category}</td>
                                    <td className="px-4 py-2 text-right text-neutral-900">{formatCurrency(Number(cat.revenue))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Shift Data */}
                <div>
                    <h3 className="text-lg font-semibold text-neutral-900 mb-4">Revenue by Shift</h3>
                    <table className="w-full text-sm text-left border border-neutral-200">
                        <thead className="bg-neutral-100 text-neutral-600 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-2 font-medium">Shift</th>
                                <th className="px-4 py-2 font-medium text-right">Revenue</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {byShift.map((shift: any, idx: number) => (
                                <tr key={idx} className={idx % 2 === 0 ? "bg-white" : "bg-neutral-50"}>
                                    <td className="px-4 py-2 text-neutral-800">{shift.shift_name}</td>
                                    <td className="px-4 py-2 text-right text-neutral-900">{formatCurrency(Number(shift.revenue))}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="mt-12 text-center text-xs text-neutral-400">
                End of Report
            </div>
        </div>
    );
}
