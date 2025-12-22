'use client';

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Search,
    ArrowUpDown,
    ArrowUpRight,
    ArrowDownLeft,
    Download,
    Loader2
} from "lucide-react";
import { TransactionDetailsModal } from "./TransactionDetailsModal";
import { Pagination } from "@/app/components/ui/Pagination";

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

interface TransactionsTableProps {
    transactions: Transaction[];
    totalPages: number;
    currentPage: number;
    totalCount: number;
}

export function TransactionsTable({
    transactions,
    totalPages,
    currentPage,
    totalCount
}: TransactionsTableProps) {
    const router = useRouter();
    const searchParams = useSearchParams();

    // Internal state for input to allow debounce
    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
    const [isExporting, setIsExporting] = useState(false);

    // Filter Type from URL
    const filterType = searchParams.get("type") || "ALL";

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            const currentSearch = searchParams.get("search") || "";
            if (search !== currentSearch) {
                const params = new URLSearchParams(searchParams.toString());
                if (search) {
                    params.set("search", search);
                } else {
                    params.delete("search");
                }
                params.set("page", "1"); // Reset to page 1 on search
                router.push(`?${params.toString()}`);
            }
        }, 300);

        return () => clearTimeout(handler);
    }, [search, router, searchParams]); // searchParams dependency is now safe because we check value difference
    // Actually, relying on searchParams in dep array for a debounced effect that PUSHES to router is tricky.
    // Better: Just depend on `search`. But we need latest searchParams to preserve 'type'.
    // The issue is if we type, we push, searchParams change, effect runs again?
    // If we only push when params change, it's fine. 
    // BUT to avoid complex dependency logic, let's keep it simple: 
    // We only trigger update if `search` changed from what's in URL?
    // Let's refine the effect deps.

    // Better approach for search inputs in Server Components:
    // Only fire router.push if the intended search term is different from current URL param.

    const handleSearchChange = (val: string) => {
        setSearch(val);
    };

    const handleFilterChange = (type: string) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("type", type);
        params.set("page", "1");
        router.push(`?${params.toString()}`);
    };

    const handleExport = async () => {
        setIsExporting(true);
        try {
            // Build current query params
            const params = new URLSearchParams(searchParams.toString());
            // Ensure we export all matching the filter, not just current page?
            // Usually export is "All matching filters".
            // The API logic will handle "if no page param, or explicit 'all' param".
            // Let's pass the params as is to the API. 
            // The API should probably ignore 'page' if we want to export ALL, or we can add `export=true`.

            const response = await fetch(`/api/admin/transactions/export?${params.toString()}`);
            if (!response.ok) throw new Error("Export failed");

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `transactions-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv`;
            document.body.appendChild(a);
            a.click();
            a.remove();
        } catch (error) {
            console.error("Export error:", error);
            alert("Failed to export transactions.");
        } finally {
            setIsExporting(false);
        }
    };

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
                        onChange={(e) => handleSearchChange(e.target.value)}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-2 pl-10 pr-4 text-sm text-neutral-200 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 rounded-lg bg-white/5 p-1 border border-white/10">
                        <button
                            onClick={() => handleFilterChange("ALL")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filterType === "ALL" ? "bg-neutral-600 text-white shadow-sm" : "text-neutral-400 hover:text-white"
                                }`}
                        >
                            All
                        </button>
                        <button
                            onClick={() => handleFilterChange("PAYMENT")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filterType === "PAYMENT" ? "bg-emerald-500/20 text-emerald-400 shadow-sm" : "text-neutral-400 hover:text-white"
                                }`}
                        >
                            Payments
                        </button>
                        <button
                            onClick={() => handleFilterChange("TOPUP")}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filterType === "TOPUP" ? "bg-indigo-500/20 text-indigo-400 shadow-sm" : "text-neutral-400 hover:text-white"
                                }`}
                        >
                            Top-ups
                        </button>
                    </div>

                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                    >
                        {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                        Export
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
                        {transactions.map((t) => (
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

                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="py-12 text-center text-neutral-500">
                                    No transactions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                hasNextPage={currentPage < totalPages}
                hasPrevPage={currentPage > 1}
            />

            <TransactionDetailsModal
                transaction={selectedTransaction}
                onClose={() => setSelectedTransaction(null)}
            />
        </div>
    );
}
