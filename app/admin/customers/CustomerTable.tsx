"use client";

import Link from "next/link";
import { useState, useMemo } from "react";

interface Customer {
    id: string;
    full_name: string | null;
    phone_number: string | null;
    ranking: number | null;
    is_member: boolean;
    membership_number?: string | null;
    wallets?: { balance: number } | { balance: number }[] | null;
    membership_tiers?: { name: string; color: string; min_wallet_balance: number } | null;
}

interface CustomerTableProps {
    customers: Customer[];
    toggleMembership: (formData: FormData) => Promise<void>;
}

export function CustomerTable({ customers, toggleMembership }: CustomerTableProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [minRank, setMinRank] = useState(1.0);
    const [maxRank, setMaxRank] = useState(7.0);

    // Client-side filtering - instant, no reload
    const filteredCustomers = useMemo(() => {
        return customers.filter((customer) => {
            const matchesSearch = !searchQuery ||
                customer.full_name?.toLowerCase().includes(searchQuery.toLowerCase());

            const rank = customer.ranking;
            // Show customers with no rank OR customers within the selected rank range
            const matchesRank = rank === null || rank === undefined || (rank >= minRank && rank <= maxRank);

            return matchesSearch && matchesRank;
        });
    }, [customers, searchQuery, minRank, maxRank]);

    return (
        <>
            {/* Filter Controls */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-neutral-50">Customer List</h2>
                <div className="flex flex-wrap gap-2">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search name..."
                        className="w-full sm:w-auto sm:min-w-[200px] rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-neutral-50 focus:border-emerald-500 focus:outline-none"
                    />

                    {/* Compact Rank Range */}
                    <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                        <span className="text-xs text-neutral-400">Rank:</span>
                        <select
                            value={minRank}
                            onChange={(e) => setMinRank(parseFloat(e.target.value))}
                            className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
                        >
                            {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((val) => (
                                <option key={val} value={val} className="bg-neutral-900">
                                    {val.toFixed(1)}
                                </option>
                            ))}
                        </select>
                        <span className="text-xs text-neutral-500">-</span>
                        <select
                            value={maxRank}
                            onChange={(e) => setMaxRank(parseFloat(e.target.value))}
                            className="bg-transparent text-xs text-neutral-200 focus:outline-none cursor-pointer"
                        >
                            {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((val) => (
                                <option key={val} value={val} className="bg-neutral-900">
                                    {val.toFixed(1)}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Results Count */}
            <div className="text-sm text-neutral-400">
                Showing {filteredCustomers.length} of {customers.length} customers
            </div>

            {/* Table */}
            <div className="overflow-hidden rounded-3xl border border-white/5 bg-neutral-900/50 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Name</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Phone</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Member #</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Rank</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Wallet</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Status</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredCustomers.map((profile) => (
                                <tr key={profile.id} className="hover:bg-white/5">
                                    <td className="px-6 py-4 font-medium text-neutral-200">
                                        <Link href={`/admin/customers/${profile.id}`} className="hover:text-emerald-400 hover:underline">
                                            {profile.full_name || "Guest"}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        {profile.phone_number || "—"}
                                    </td>
                                    <td className="px-6 py-4">
                                        {profile.membership_number ? (
                                            <span className="font-mono text-sm text-neutral-200 tracking-[0.2em]">
                                                {profile.membership_number}
                                            </span>
                                        ) : (
                                            <span className="text-neutral-600">—</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">{profile.ranking ? (
                                        <span className="inline-flex items-center rounded-lg bg-orange-500/10 px-2.5 py-1 text-xs font-medium text-orange-400 border border-orange-500/20 font-mono">
                                            {Number(profile.ranking).toFixed(1)}
                                        </span>
                                    ) : (
                                        <span className="text-neutral-600">-</span>
                                    )}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-emerald-400">
                                        ₱{Number((Array.isArray(profile.wallets) ? profile.wallets[0]?.balance : profile.wallets?.balance) || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {profile.membership_tiers ? (
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold border"
                                                    style={{
                                                        borderColor: `${profile.membership_tiers.color}40`,
                                                        color: profile.membership_tiers.color,
                                                        backgroundColor: `${profile.membership_tiers.color}10`
                                                    }}
                                                >
                                                    {profile.membership_tiers.name}
                                                </span>
                                                {(Number(Array.isArray(profile.wallets) ? profile.wallets[0]?.balance : profile.wallets?.balance || 0)) < (profile.membership_tiers.min_wallet_balance || 0) && (
                                                    <div className="group relative">
                                                        <span className="text-amber-500 cursor-help">⚠️</span>
                                                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-2 bg-black/90 border border-white/10 rounded-lg text-xs text-neutral-300 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 w-max max-w-[200px] shadow-xl">
                                                            Min. Balance Required: ₱{Number(profile.membership_tiers.min_wallet_balance).toLocaleString()}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : profile.is_member ? (
                                            <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                                                Member
                                            </span>
                                        ) : (
                                            <span className="text-neutral-500">Regular</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <form action={toggleMembership}>
                                            <input type="hidden" name="id" value={profile.id} />
                                            <input type="hidden" name="currentState" value={String(profile.is_member || false)} />
                                            <button
                                                type="submit"
                                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${profile.is_member
                                                    ? "border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                    : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                    }`}
                                            >
                                                {profile.is_member ? "Revoke" : "Upgrade"}
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                            {filteredCustomers.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-neutral-500">
                                        No customers found matching your filters.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}
