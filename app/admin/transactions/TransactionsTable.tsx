'use client';

import { useState } from "react";
import { format } from "date-fns";
import {
    Search,
    ArrowUpDown,
    ArrowUpRight,
    ArrowDownLeft,
} from "lucide-react";
import { TransactionDetailsModal } from "./TransactionDetailsModal";

type Transaction = {
    id: string;
    created_at: string;
    amount: number;
    type: 'PAYMENT' | 'TOPUP';
    method: string;
    customer_name: string;
    reference_id: string | null;
    profile_id: string | null;
    description: string;
};

export function TransactionsTable({ transactions }: { transactions: Transaction[] }) {
    const [search, setSearch] = useState("");
    const [filterType, setFilterType] = useState<"ALL" | "PAYMENT" | "TOPUP">("ALL");
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

    // Filter Logic
    const filtered = transactions.filter(t => {
        const matchesSearch =
            t.customer_name.toLowerCase().includes(search.toLowerCase()) ||
            t.description.toLowerCase().includes(search.toLowerCase()) ||
            t.method.toLowerCase().includes(search.toLowerCase());

        const matchesType = filterType === "ALL" || t.type === filterType;

        return matchesSearch && matchesType;
    });

    return (
        <div className="space-y-4">
            {/* Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative max-w-sm flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
                    <input
                        type="text"
                        placeholder="Search transactions..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setFilterType("ALL")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filterType === "ALL" ? "bg-white/10 text-white" : "text-neutral-400 hover:text-white"
                            }`}
                    >
                        All
                    </button>
                    <button
                        onClick={() => setFilterType("PAYMENT")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filterType === "PAYMENT" ? "bg-emerald-500/10 text-emerald-400" : "text-neutral-400 hover:text-white"
                            }`}
                    >
                        Payments
                    </button>
                    <button
                        onClick={() => setFilterType("TOPUP")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${filterType === "TOPUP" ? "bg-indigo-500/10 text-indigo-400" : "text-neutral-400 hover:text-white"
                            }`}
                    >
                        Top-ups
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-xs font-medium text-neutral-400">
                        <tr>
                            <th className="px-6 py-4">Date</th>
                            <th className="px-6 py-4">Type</th>
                            <th className="px-6 py-4">Customer</th>
                            <th className="px-6 py-4">Description</th>
                            <th className="px-6 py-4">Method</th>
                            <th className="px-6 py-4 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-neutral-300">
                        {filtered.map((t) => (
                            <tr
                                key={t.id}
                                onClick={() => setSelectedTransaction(t)}
                                className={`group transition hover:bg-white/5 cursor-pointer`}
                            >
                                <td className="whitespace-nowrap px-6 py-4 text-neutral-400">
                                    {format(new Date(t.created_at), "MMM d, h:mm a")}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4">
                                    {t.type === 'PAYMENT' ? (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 border border-emerald-500/20">
                                            <ArrowDownLeft className="h-3 w-3" />
                                            Payment
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-400 border border-indigo-500/20">
                                            <ArrowUpRight className="h-3 w-3" />
                                            Top-up
                                        </span>
                                    )}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 font-medium text-white">
                                    {t.customer_name}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-neutral-400 group-hover:text-neutral-200">
                                    {t.description}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 uppercase text-xs font-bold tracking-wider text-neutral-500">
                                    {t.method}
                                </td>
                                <td className="whitespace-nowrap px-6 py-4 text-right font-mono font-medium text-white">
                                    ₱{t.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                            </tr>
                        ))}

                        {filtered.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-neutral-500">
                                    No transactions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <TransactionDetailsModal
                transaction={selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
            />
        </div>
    );
}
