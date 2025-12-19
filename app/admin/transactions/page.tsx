import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TransactionsTable } from "./TransactionsTable";
import { redirect } from "next/navigation";

export default async function TransactionsPage() {
    const supabase = createSupabaseServerClient();

    // Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect("/admin/login");

    // Fetch Transactions from View
    const { data: transactions, error } = await supabase
        .from("admin_transactions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

    if (error) {
        console.error("Error fetching transactions:", error);
        return <div className="p-8 text-red-500">Error loading transactions. Please check database logs.</div>;
    }

    // Calculate Totals
    const totalRevenue = transactions?.reduce((sum, t) => sum + (t.type === 'PAYMENT' ? t.amount : 0), 0) || 0;
    const totalDeposits = transactions?.reduce((sum, t) => sum + (t.type === 'TOPUP' ? t.amount : 0), 0) || 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-50">Transactions</h1>
                    <p className="text-neutral-400">Financial history including Orders and Wallet Top-ups.</p>
                </div>
                <div className="flex gap-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                        <div className="text-xs text-neutral-500">Total Revenue</div>
                        <div className="text-lg font-bold text-emerald-400">₱{totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                        <div className="text-xs text-neutral-500">Wallet Deposits</div>
                        <div className="text-lg font-bold text-indigo-400">₱{totalDeposits.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <TransactionsTable transactions={transactions || []} />
        </div>
    );
}
