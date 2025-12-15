import { formatCurrency } from "../format";
import { Card } from "@/app/components/ui/Card";

interface MonthlyMetricsProps {
    topCustomers: any[];
    walletLiability: number;
    walletDeposits: number;
}

export function MonthlyMetrics({ topCustomers, walletLiability, walletDeposits }: MonthlyMetricsProps) {
    return (
        <div className="space-y-6 mt-8">
            <h3 className="text-lg font-bold text-neutral-100 uppercase tracking-widest border-b border-white/10 pb-2">
                Customer & Wallet Analytics
            </h3>

            {/* Wallet Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-neutral-900/50 border-emerald-500/10">
                    <div className="text-sm font-medium uppercase tracking-wider text-neutral-500 mb-1">
                        Credits Purchased (This Month)
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(walletDeposits)}
                    </div>
                    <p className="text-xs text-neutral-600 mt-2">
                        Total wallet top-ups made in this period.
                    </p>
                </Card>

                <Card className="p-6 bg-gradient-to-br from-neutral-900 to-neutral-900/50 border-amber-500/10">
                    <div className="text-sm font-medium uppercase tracking-wider text-neutral-500 mb-1">
                        Total Unconsumed Credits (Liability)
                    </div>
                    <div className="text-2xl font-bold text-amber-500">
                        {formatCurrency(walletLiability)}
                    </div>
                    <p className="text-xs text-neutral-600 mt-2">
                        Current total balance across all user wallets.
                    </p>
                </Card>
            </div>

            {/* Top Customers */}
            <Card>
                <div className="mb-4">
                    <div className="text-sm font-medium uppercase tracking-widest text-neutral-400">
                        Top Customers
                    </div>
                    <p className="text-xs text-neutral-600">
                        Based on paid orders within this period. Includes both registered members and walk-ins.
                    </p>
                </div>

                <div className="max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10">
                    <table className="w-full text-left text-sm">
                        <thead className="sticky top-0 bg-[#0a0a0a] text-neutral-500">
                            <tr>
                                <th className="pb-3 pl-2 font-medium">Rank</th>
                                <th className="pb-3 font-medium">Customer Name</th>
                                <th className="pb-3 text-center font-medium">Visits</th>
                                <th className="pb-3 text-right pr-2 font-medium">Total Spent</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-neutral-300">
                            {topCustomers && topCustomers.length > 0 ? (
                                topCustomers.map((customer, index) => (
                                    <tr key={customer.profile_id || `walkin-${index}`} className="group hover:bg-white/5 transition-colors">
                                        <td className="py-3 pl-2 text-neutral-600 font-mono text-xs">
                                            #{index + 1}
                                        </td>
                                        <td className="py-3 font-medium text-neutral-200 group-hover:text-white">
                                            {customer.full_name || "Unknown"}
                                            {!customer.is_registered && (
                                                <span className="ml-2 text-xs text-neutral-500 font-normal border border-white/10 px-1.5 py-0.5 rounded">
                                                    Walk-in
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-3 text-center text-neutral-400">
                                            {customer.visit_count}
                                        </td>
                                        <td className="py-3 pr-2 text-right font-bold text-emerald-400">
                                            {formatCurrency(customer.total_spent)}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-neutral-500 italic">
                                        No registered customer data found for this period.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
