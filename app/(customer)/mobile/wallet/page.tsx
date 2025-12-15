import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { TopUpButton } from "./TopUpButton";

import { PullToRefresh } from "./PullToRefresh";

export default async function WalletPage() {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: wallet } = await supabase
        .from("wallets")
        .select("*, wallet_transactions(*)")
        .eq("profile_id", user.id)
        .single();

    // Reverse transactions to show newest first if they are not ordered by query
    // Ideally we should order string by created_at desc in the query
    const transactions = wallet?.wallet_transactions?.sort((a: any, b: any) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    ) || [];

    return (
        <PullToRefresh>
            <div className="p-6 space-y-6 max-w-md mx-auto pt-8 min-h-[80vh]">
                <h1 className="text-2xl font-bold tracking-tight text-white">My Wallet</h1>

                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 p-6 shadow-2xl shadow-black/40">
                    {/* Refined texture */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] bg-repeat bg-[length:100px_100px]"></div>

                    {/* Subtle glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.03] rounded-full blur-3xl"></div>

                    <div className="relative z-10">
                        <p className="text-xs font-semibold text-neutral-500 mb-2 tracking-wider uppercase">Balance</p>
                        <p className="text-4xl font-bold text-white tracking-tight">
                            ₱{wallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                        </p>
                        <div className="mt-6">
                            <TopUpButton />
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="font-bold text-lg text-white tracking-tight">Recent Transactions</h2>
                    <div className="space-y-3 pb-10">
                        {transactions.length > 0 ? (
                            transactions.map((tx: any) => (
                                <div key={tx.id} className="flex justify-between items-center rounded-xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-4 shadow-sm backdrop-blur-sm">
                                    <div>
                                        <p className="font-semibold capitalize text-white text-sm">{tx.type.toLowerCase()}</p>
                                        <p className="text-xs text-neutral-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={tx.amount > 0 ? "text-emerald-400 font-bold" : "text-red-400 font-bold"}>
                                        {tx.amount > 0 ? "+" : ""}₱{Math.abs(tx.amount).toLocaleString()}
                                    </span>
                                </div>
                            ))
                        ) : (
                            <p className="text-neutral-500 text-center py-8">No transactions yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </PullToRefresh>
    );
}
