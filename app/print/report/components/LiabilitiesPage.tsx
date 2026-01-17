import { formatCurrency } from "../../../admin/reports/format";
import { ReportData, WalletLiability, WalkInLiability } from "../../../admin/reports/data";
import { ReportHeader } from "./ReportHeader";
import { ReportFooter } from "./ReportFooter";

interface LiabilitiesPageProps {
    data: ReportData;
    periodStr: string;
    pageNumber: number;
}

export function LiabilitiesPage({ data, periodStr, pageNumber }: LiabilitiesPageProps) {
    const liabilities = data.liabilities || [];
    const walkInLiabilities = data.walkInLiabilities || [];
    const totalWalletLiability = liabilities.reduce((sum, item) => sum + Number(item.balance), 0);
    const totalWalkInLiability = walkInLiabilities.reduce((sum, item) => sum + Number(item.amount), 0);
    const grandTotalLiability = totalWalletLiability + totalWalkInLiability;

    // Sort walk-ins by amount (highest to lowest)
    const sortedWalkIns = [...walkInLiabilities].sort((a, b) => b.amount - a.amount);

    return (
        <div className="print-page">
            <ReportHeader title="Liabilities & Unpaid Credits" period={periodStr} />
            <div className="flex-1 flex flex-col pt-8 px-8">
                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                    <div className="bg-neutral-100 border border-neutral-200 p-4 rounded-lg text-black">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                            Wallet Balances
                        </div>
                        <div className="text-xl font-bold">{formatCurrency(totalWalletLiability)}</div>
                        <div className="text-[10px] text-neutral-500 mt-1 font-medium">Cash Held (Prepaid)</div>
                    </div>
                    <div className="bg-neutral-100 border border-neutral-200 p-4 rounded-lg text-black">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                            Walk-in Credits (Unpaid)
                        </div>
                        <div className="text-xl font-bold text-amber-600">{formatCurrency(totalWalkInLiability)}</div>
                        <div className="text-[10px] text-neutral-500 mt-1 font-medium">Pending Revenue</div>
                    </div>
                    <div className="bg-neutral-100 border border-neutral-200 p-4 rounded-lg text-black">
                        <div className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
                            Total Accounts
                        </div>
                        <div className="text-xl font-bold">{liabilities.length + walkInLiabilities.length}</div>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                    {/* Wallet Balances Table */}
                    <div>
                        <h3 className="text-lg font-bold text-black mb-4">Wallet Balances (Prepaid)</h3>
                        <div className="border border-neutral-300 rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-100 border-b border-neutral-300 text-neutral-600">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold text-left">Customer</th>
                                        <th className="px-4 py-2 font-semibold text-right">Balance</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {liabilities.slice(0, 10).map((l) => (
                                        <tr key={l.id}>
                                            <td className="px-4 py-2 text-neutral-800">
                                                {l.profiles?.full_name || "Unknown"}
                                            </td>
                                            <td className="px-4 py-2 text-right font-medium text-emerald-600">
                                                {formatCurrency(l.balance)}
                                            </td>
                                        </tr>
                                    ))}
                                    {/* Overflow row removed */}
                                    {liabilities.length === 0 && (
                                        <tr>
                                            <td colSpan={2} className="px-4 py-4 text-center text-neutral-500">
                                                No active wallet liabilities.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Walk-in Credits Table */}
                    <div>
                        <h3 className="text-lg font-bold text-black mb-4">Top 10 Unpaid Credits</h3>
                        <div className="border border-neutral-300 rounded overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-neutral-100 border-b border-neutral-300 text-neutral-600">
                                    <tr>
                                        <th className="px-4 py-2 font-semibold text-left">Customer / Label</th>
                                        <th className="px-4 py-2 font-semibold text-right">Amount</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-neutral-200">
                                    {sortedWalkIns.slice(0, 10).map((w) => (
                                        <tr key={w.session_id}>
                                            <td className="px-4 py-2 text-neutral-800">
                                                {w.customer_name} <span className="text-xs text-neutral-500">({new Date(w.opened_at).toLocaleDateString()})</span>
                                            </td>
                                            <td className="px-4 py-2 text-right font-medium text-amber-600">
                                                {formatCurrency(w.amount)}
                                            </td>
                                        </tr>
                                    ))}
                                    {walkInLiabilities.length === 0 && (
                                        <tr>
                                            <td colSpan={2} className="px-4 py-4 text-center text-neutral-500">
                                                No active walk-in credits.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
            <ReportFooter pageNumber={pageNumber} />
        </div>
    );
}
