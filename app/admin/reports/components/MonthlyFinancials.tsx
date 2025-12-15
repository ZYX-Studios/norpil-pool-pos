import { formatCurrency } from "../format";
import { Card } from "@/app/components/ui/Card";
import { FinancialCharts } from "./FinancialCharts";

interface MonthlyFinancialsProps {
    data: {
        sales: number;
        totalExpenses: number;
        cashCollected: number;
        walletUsage: number;
        netProfit: number;
        cashFlow: number;
        breakdown: {
            cash: number;
            gcash: number;
            other: number;
            deposits: number;
        };
        categories: {
            pool: number;
            food: number;
            drinks: number;
            other: number;
        };
    } | null;
}

export function MonthlyFinancials({ data }: MonthlyFinancialsProps) {
    if (!data) return null;

    return (
        <div className="space-y-6">
            <div className="flex items-end justify-between border-b border-white/10 pb-2">
                <h3 className="text-lg font-bold uppercase tracking-widest text-neutral-100">
                    Financial Performance
                </h3>
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* SALES CONTEXT (Blue/Neutral) */}
                <Card className="flex flex-col gap-4 p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/50 border-neutral-700/50">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-blue-400">
                            Service Revenue (Sales)
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pb-2">
                        <div>
                            <div className="text-xl font-bold text-white">
                                {formatCurrency(data.sales)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Gross Sales
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-rose-400">
                                - {formatCurrency(data.totalExpenses)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Expenses
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-xl font-bold text-blue-300">
                                {formatCurrency(data.netProfit)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Net Profit
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-neutral-600 border-t border-white/5 pt-2">
                        Accrual Basis. Includes all verified orders regardless of payment status.
                    </div>
                </Card>

                {/* CASH CONTEXT (Green) */}
                <Card className="flex flex-col gap-4 p-5 bg-gradient-to-br from-neutral-900 to-neutral-900/50 border-emerald-900/50 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full translate-x-10 -translate-y-10" />

                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                            Liquidity (Cash Flow)
                        </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 pb-2 relative z-10">
                        <div>
                            <div className="text-xl font-bold text-emerald-400">
                                {formatCurrency(data.cashCollected)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Cash Collected
                            </div>
                        </div>
                        <div className="text-center">
                            <div className="text-xl font-bold text-rose-400">
                                - {formatCurrency(data.totalExpenses)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Expenses
                            </div>
                        </div>
                        <div className="text-right">
                            <div className={`text-xl font-bold ${data.cashFlow >= 0 ? 'text-emerald-300' : 'text-rose-400'}`}>
                                {formatCurrency(data.cashFlow)}
                            </div>
                            <div className="text-[10px] uppercase tracking-wider text-neutral-500 mt-1">
                                Net Cash Flow
                            </div>
                        </div>
                    </div>
                    <div className="text-[10px] text-neutral-600 border-t border-white/5 pt-2 relative z-10">
                        Cash Basis. Actual money received minus expenses.
                    </div>
                </Card>
            </div>

            {/* VISUAL BREAKDOWN */}
            <FinancialCharts data={data} />
        </div>
    );
}
