import { formatCurrency } from "../format";
import { StatCard } from "@/app/components/ui/StatCard";
import { WalletLiability, WalkInLiability } from "../data";

interface LiabilitiesSectionProps {
    liabilities: WalletLiability[];
    walkInLiabilities?: WalkInLiability[];
    totalLiability: number;
}

export function LiabilitiesSection({ liabilities, walkInLiabilities = [], totalLiability }: LiabilitiesSectionProps) {
    const totalWalkInLiability = walkInLiabilities.reduce((sum, item) => sum + Number(item.amount), 0);
    const grandTotalLiability = totalLiability + totalWalkInLiability;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-300">
                    Liabilities & Unpaid Credits
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                    Outstanding wallet balances (prepaid) and active walk-in credits (unpaid).
                </p>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <StatCard
                    label="Wallet Balances (Prepaid)"
                    value={formatCurrency(totalLiability)}
                    subValue="Cash Held (Prepaid)"
                />
                <StatCard
                    label="Walk-in Credits (Unpaid)"
                    value={formatCurrency(totalWalkInLiability)}
                    subValue="Pending Revenue"
                />
                <StatCard
                    label="Total Accounts"
                    value={liabilities.length + walkInLiabilities.length}
                />
            </div>

            {/* Wallet Liabilities Table */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-neutral-200">Wallet Balances</h3>
                <div className="rounded-lg border border-neutral-800 bg-black/40 p-1">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-neutral-800 bg-white/5 text-neutral-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Customer</th>
                                    <th className="px-4 py-3 font-medium">Contact</th>
                                    <th className="px-4 py-3 font-medium text-right">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                                {liabilities.map((l) => (
                                    <tr key={l.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium text-neutral-200">
                                            {l.profiles?.full_name || "Unknown"}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-400">
                                            {l.profiles?.phone || "-"}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-emerald-400">
                                            {formatCurrency(l.balance)}
                                        </td>
                                    </tr>
                                ))}
                                {liabilities.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                                            No active wallet liabilities found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Walk-in Credits Table */}
            <div className="space-y-4">
                <h3 className="text-lg font-medium text-neutral-200">Active Walk-in Credits (Released / Unpaid)</h3>
                <div className="rounded-lg border border-neutral-800 bg-black/40 p-1">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-neutral-800 bg-white/5 text-neutral-400">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Customer / Label</th>
                                    <th className="px-4 py-3 font-medium">Opened At</th>
                                    <th className="px-4 py-3 font-medium text-right">Amount Due</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-800">
                                {walkInLiabilities.map((w) => (
                                    <tr key={w.session_id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium text-neutral-200">
                                            {w.customer_name}
                                        </td>
                                        <td className="px-4 py-3 text-neutral-400">
                                            {new Date(w.opened_at).toLocaleDateString()} {new Date(w.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-4 py-3 text-right font-medium text-amber-400">
                                            {formatCurrency(w.amount)}
                                        </td>
                                    </tr>
                                ))}
                                {walkInLiabilities.length === 0 && (
                                    <tr>
                                        <td colSpan={3} className="px-4 py-8 text-center text-neutral-500">
                                            No active walk-in credits found.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
