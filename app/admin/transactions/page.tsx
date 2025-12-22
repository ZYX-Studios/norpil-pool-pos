import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TransactionsTable } from "./TransactionsTable";
import { redirect } from "next/navigation";

export default async function TransactionsPage(props: {
    searchParams: Promise<{ page?: string; search?: string; type?: string }>;
}) {
    const searchParams = await props.searchParams;
    const supabase = createSupabaseServerClient();

    // 1. Parse Params
    const currentPage = Number(searchParams?.page) || 1;
    const query = searchParams?.search || "";
    const typeFilter = searchParams?.type || "ALL"; // ALL, PAYMENT, TOPUP
    const ITEMS_PER_PAGE = 20;

    // 2. Auth Check
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return redirect("/admin/login");

    // 3. Totals (Separate queries for accuracy, slightly expensive but okay for now)
    // Note: To optimize, we could create a DB function or use specific aggregate queries.
    // specific aggregate queries are better than fetching all rows.
    // For now, let's just get the count and a separate sum if needed, 
    // but the original code did a full fetch. Let's optimize slightly by using `count` for pagination
    // and maybe a separate aggregated query for totals if possible, OR just sum the visible page?
    // No, totals usually mean "Total All Time". 
    // Let's keep the totals calculation roughly as is or use a more efficient way.
    // Fetching 500 records just for totals is not scalable. 
    // Let's TRY to use Postgres aggregates if we can, otherwise, we might have to accept 
    // that we can't calculate *exact* all-time totals without a heavy query.
    // BUT, the user wants "Reporting".
    // Let's do a separate query for totals.

    // Aggregation for totals (All time)
    // We can't easily do `sum` in supabase js client without rpc or fetching. 
    // Let's assume for now we remove the "Total Revenue" cards OR we fetch a restricted amount / use current view.
    // The original code fetched 500 limit. 
    // Let's just limit the totals calculation to "Recent Transactions" or try to fetch all IDs and amounts?
    // Let's try to assume we want accurate totals.
    // We'll skip complex aggregation for this step to focus on Pagination/Export 
    // and leave the totals cards with a "cached" or separate fetch strategy if needed.
    // For now, let's just NOT compute totals on the fly server side if it means fetching everything.
    // OR we can keep the "limit 500" logic JUST for the stats? 
    // Let's do that: Fetch 500 latest for stats (approximate "Recent Revenue"), and use PAGINATION for the table.

    const { data: recentTransactions } = await supabase
        .from("admin_transactions")
        .select("amount, type")
        .order("created_at", { ascending: false })
        .limit(1000); // Increased limit for better stats accuracy

    const totalRevenue = recentTransactions?.reduce((sum, t) => sum + (t.type === 'PAYMENT' ? t.amount : 0), 0) || 0;
    const totalDeposits = recentTransactions?.reduce((sum, t) => sum + (t.type === 'TOPUP' ? t.amount : 0), 0) || 0;

    // 4. Filtered Query for Table
    let tableQuery = supabase
        .from("admin_transactions")
        .select("*", { count: "exact" });

    // Apply Search
    if (query) {
        tableQuery = tableQuery.or(`customer_name.ilike.%${query}%,description.ilike.%${query}%,method.ilike.%${query}%`);
    }

    // Apply Type Filter
    if (typeFilter !== "ALL") {
        tableQuery = tableQuery.eq("type", typeFilter);
    }

    // Apply Pagination
    const from = (currentPage - 1) * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    tableQuery = tableQuery
        .order("created_at", { ascending: false })
        .range(from, to);

    const { data: transactions, count, error } = await tableQuery;

    if (error) {
        console.error("Error fetching transactions:", error);
        return <div className="p-8 text-red-500">Error loading transactions. Please check database logs.</div>;
    }

    const totalPages = count ? Math.ceil(count / ITEMS_PER_PAGE) : 0;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-50">Transactions</h1>
                    <p className="text-neutral-400">Financial history including Orders and Wallet Top-ups.</p>
                </div>
                <div className="flex gap-4">
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                        <div className="text-xs text-neutral-500">Recent Revenue</div>
                        <div className="text-lg font-bold text-emerald-400">₱{totalRevenue.toLocaleString()}</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-right">
                        <div className="text-xs text-neutral-500">Recent Deposits</div>
                        <div className="text-lg font-bold text-indigo-400">₱{totalDeposits.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            <TransactionsTable
                transactions={transactions || []}
                totalPages={totalPages}
                currentPage={currentPage}
                totalCount={count || 0}
            />
        </div>
    );
}
