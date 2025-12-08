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
            <div className="p-6 space-y-6 max-w-md mx-auto min-h-[80vh]">
                <h1 className="text-2xl font-bold text-neutral-50">My Wallet</h1>

                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-lg shadow-emerald-500/20 backdrop-blur">
                    <p className="text-sm text-emerald-200/80">Current Balance</p>
                    <p className="text-4xl font-bold mt-1 text-emerald-400">
                        ₱{wallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                    </p>
                    <div className="mt-6">
                        <TopUpButton />
                    </div>
                </div>

                <div className="space-y-4">
                    <h2 className="font-semibold text-lg text-neutral-200">Recent Transactions</h2>
                    <div className="space-y-3 pb-10">
                        {transactions.length > 0 ? (
                            transactions.map((tx: any) => (
                                <div key={tx.id} className="flex justify-between items-center rounded-xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
                                    <div>
                                        <p className="font-medium capitalize text-neutral-200">{tx.type.toLowerCase()}</p>
                                        <p className="text-xs text-neutral-400">{new Date(tx.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <span className={tx.amount > 0 ? "text-emerald-400 font-bold" : "text-rose-400 font-bold"}>
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
