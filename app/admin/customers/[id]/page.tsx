import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function CustomerDetailPage({
    params
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const supabase = createSupabaseServerClient();

    // Fetch Profile with Wallet
    const { data: profile, error } = await supabase
        .from("profiles")
        .select(`
            *,
            wallets (
                id,
                balance,
                updated_at
            )
        `)
        .eq("id", id)
        .single();

    if (!profile) {
        return notFound();
    }

    // Fetch Wallet Transactions
    const { data: transactions } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", profile.wallets?.id)
        .order("created_at", { ascending: false })
        .limit(20);

    // Fetch Recent Sessions
    const { data: sessions } = await supabase
        .from("table_sessions")
        .select("id, opened_at, closed_at, status, pool_tables(name), orders(total)")
        .eq("profile_id", id)
        .order("opened_at", { ascending: false })
        .limit(10);

    async function toggleMembership() {
        "use server";
        const supabase = createSupabaseServerClient();
        await supabase.from("profiles")
            .update({ is_member: !profile.is_member })
            .eq("id", id);
        revalidatePath(`/admin/customers/${id}`);
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <Link href="/admin/customers" className="mb-2 inline-block text-xs font-medium text-neutral-500 hover:text-white">
                    ← Back to Customers
                </Link>
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-neutral-50">{profile.full_name || "Guest Customer"}</h1>
                        <p className="text-neutral-400">Customer Details & History</p>
                    </div>
                    <form action={toggleMembership}>
                        <button
                            type="submit"
                            className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${profile.is_member
                                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                }`}
                        >
                            {profile.is_member ? "Revoke Membership" : "Upgrade to Member"}
                        </button>
                    </form>
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                {/* Info Card */}
                <div className="space-y-6 lg:col-span-1">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">Profile</h3>
                        <div className="space-y-4">
                            <div>
                                <div className="text-xs text-neutral-500">Phone</div>
                                <div className="text-neutral-200">{profile.phone_number || "—"}</div>
                            </div>
                            <div>
                                <div className="text-xs text-neutral-500">Member Status</div>
                                <div className="mt-1">
                                    {profile.is_member ? (
                                        <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                                            Active Member
                                        </span>
                                    ) : (
                                        <span className="text-neutral-400">Regular Customer</span>
                                    )}
                                </div>
                            </div>
                            <div>
                                <div className="text-xs text-neutral-500">Joined</div>
                                <div className="text-neutral-200">
                                    {new Date(profile.created_at).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-neutral-400">Wallet</h3>
                        <div className="flex items-baseline justify-between">
                            <div className="text-3xl font-bold text-emerald-400">
                                ₱{Number(profile.wallets?.balance || 0).toLocaleString()}
                            </div>
                            <div className="text-xs text-neutral-500">Current Balance</div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="space-y-6 lg:col-span-2">
                    {/* Wallet History */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                        <h3 className="mb-4 text-lg font-semibold text-neutral-50">Wallet History</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-neutral-500">
                                    <tr>
                                        <th className="pb-3 font-medium">Type</th>
                                        <th className="pb-3 font-medium">Amount</th>
                                        <th className="pb-3 font-medium">Date</th>
                                        <th className="pb-3 font-medium">Description</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-neutral-300">
                                    {transactions?.map((tx) => (
                                        <tr key={tx.id}>
                                            <td className="py-3">
                                                <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${tx.type === 'DEPOSIT' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/10 text-neutral-300'
                                                    }`}>
                                                    {tx.type}
                                                </span>
                                            </td>
                                            <td className={`py-3 font-medium ${tx.amount > 0 ? 'text-emerald-400' : 'text-neutral-200'}`}>
                                                {tx.amount > 0 ? '+' : ''}₱{Math.abs(tx.amount).toLocaleString()}
                                            </td>
                                            <td className="py-3 text-neutral-500">
                                                {new Date(tx.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="py-3 text-neutral-400">
                                                {tx.description}
                                            </td>
                                        </tr>
                                    ))}
                                    {!transactions?.length && (
                                        <tr><td colSpan={4} className="py-4 text-center text-neutral-500">No transactions found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Recent Sessions */}
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                        <h3 className="mb-4 text-lg font-semibold text-neutral-50">Recent Sessions</h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-xs text-neutral-500">
                                    <tr>
                                        <th className="pb-3 font-medium">Date</th>
                                        <th className="pb-3 font-medium">Table</th>
                                        <th className="pb-3 font-medium">Status</th>
                                        <th className="pb-3 font-medium text-right">Total</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-neutral-300">
                                    {sessions?.map((session: any) => (
                                        <tr key={session.id}>
                                            <td className="py-3 text-neutral-400">
                                                {new Date(session.opened_at).toLocaleDateString()} {new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </td>
                                            <td className="py-3">
                                                {session.pool_tables?.name || "Unknown"}
                                            </td>
                                            <td className="py-3">
                                                <span className={`text-xs ${session.status === 'OPEN' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                                    {session.status}
                                                </span>
                                            </td>
                                            <td className="py-3 text-right font-medium">
                                                ₱{session.orders?.[0]?.total ? Number(session.orders[0].total).toLocaleString() : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {!sessions?.length && (
                                        <tr><td colSpan={4} className="py-4 text-center text-neutral-500">No sessions found.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
