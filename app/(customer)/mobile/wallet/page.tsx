import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WalletPage() {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: wallet } = await supabase
        .from("wallets")
        .select("*, wallet_transactions(*)")
        .eq("profile_id", user.id)
        .single();

    return (
        <div className="p-6 space-y-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-neutral-50">My Wallet</h1>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 shadow-lg shadow-emerald-500/20 backdrop-blur">
                <p className="text-sm text-emerald-200/80">Current Balance</p>
                <p className="text-4xl font-bold mt-1 text-emerald-400">
                    ₱{wallet?.balance?.toLocaleString(undefined, { minimumFractionDigits: 2 }) ?? "0.00"}
                </p>
            </div>

            <div className="space-y-4">
                <h2 className="font-semibold text-lg text-neutral-200">Recent Transactions</h2>
                <div className="space-y-3">
                    {wallet?.wallet_transactions && wallet.wallet_transactions.length > 0 ? (
                        wallet.wallet_transactions.map((tx: any) => (
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
    );
}
