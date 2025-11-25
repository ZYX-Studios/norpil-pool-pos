import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency, formatPercent } from "../../../admin/reports/format";

interface RisksIssuesOpportunitiesProps {
    data: ReportData;
}

export function RisksIssuesOpportunities({ data }: RisksIssuesOpportunitiesProps) {
    const totalRevenue = Number(data.total ?? 0);
    const expenseArray = data.expenses ?? [];
    const totalExpenses = expenseArray.reduce((sum, exp) => sum + Number(exp.amount ?? 0), 0);
    const netProfit = totalRevenue - totalExpenses;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const txArray = data.tx ?? [];
    const totalTransactions = txArray.length;
    const averageTicket = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Logic for Risks
    const risks: string[] = [];
    if (netMargin < 20) risks.push("Net margin is below 20%. Consider reviewing pricing or reducing expenses.");
    if (netProfit < 0) risks.push("The business is operating at a loss for this period.");
    if (totalTransactions === 0) risks.push("No transactions recorded for this period.");

    // Logic for Issues
    const issues: string[] = [];
    const drinkMargins = data.drinkMargins ?? [];
    const alcoholicRevenue = drinkMargins.find((d: any) => d.type === "Alcoholic")?.revenue || 0;
    const nonAlcoholicRevenue = drinkMargins.find((d: any) => d.type === "Non-Alcoholic")?.revenue || 0;

    if (alcoholicRevenue === 0 && totalRevenue > 0) issues.push("Zero alcoholic beverage sales detected. Verify inventory or POS entry.");

    // Logic for Opportunities
    const opportunities: string[] = [];
    if (averageTicket > 500) opportunities.push("High average ticket value indicates strong customer spending power. Consider premium upsells.");
    if (netMargin > 40) opportunities.push("Healthy margins suggest room for reinvestment in marketing or equipment.");

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Risks, Issues & Opportunities
            </h2>

            <div className="space-y-8">
                {/* Risks */}
                <div className="bg-red-50 border-l-4 border-red-500 p-6 rounded-r-lg">
                    <h3 className="text-lg font-bold text-red-700 mb-3 flex items-center">
                        <span className="mr-2">⚠️</span> Risks (Red Flags)
                    </h3>
                    {risks.length > 0 ? (
                        <ul className="list-disc list-inside text-red-800 space-y-2">
                            {risks.map((risk, idx) => <li key={idx}>{risk}</li>)}
                        </ul>
                    ) : (
                        <p className="text-red-800 italic">No critical risks detected based on available data.</p>
                    )}
                </div>

                {/* Issues */}
                <div className="bg-amber-50 border-l-4 border-amber-500 p-6 rounded-r-lg">
                    <h3 className="text-lg font-bold text-amber-700 mb-3 flex items-center">
                        <span className="mr-2">🔸</span> Operational Issues
                    </h3>
                    {issues.length > 0 ? (
                        <ul className="list-disc list-inside text-amber-800 space-y-2">
                            {issues.map((issue, idx) => <li key={idx}>{issue}</li>)}
                        </ul>
                    ) : (
                        <p className="text-amber-800 italic">No major operational anomalies detected.</p>
                    )}
                </div>

                {/* Opportunities */}
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-6 rounded-r-lg">
                    <h3 className="text-lg font-bold text-emerald-700 mb-3 flex items-center">
                        <span className="mr-2">🚀</span> Growth Opportunities
                    </h3>
                    {opportunities.length > 0 ? (
                        <ul className="list-disc list-inside text-emerald-800 space-y-2">
                            {opportunities.map((opp, idx) => <li key={idx}>{opp}</li>)}
                        </ul>
                    ) : (
                        <p className="text-emerald-800 italic">Maintain current performance trajectory.</p>
                    )}
                </div>
            </div>
        </div>
    );
}
