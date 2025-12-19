import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogsTable from "./LogsTable";
import LogFilter from "./LogFilter";

export const dynamic = "force-dynamic";

import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export default async function LogsPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}) {
    const { staff: currentStaff } = await getCurrentUserWithStaff();
    if (currentStaff?.role !== "ADMIN" && currentStaff?.role !== "OWNER") redirect("/admin");

    const supabase = createSupabaseServerClient();

    const params = await searchParams;
    const actionFilter = typeof params?.action === 'string' ? params.action : null;

    // Fetch logs
    let query = supabase
        .from("action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

    if (actionFilter) {
        query = query.eq("action_type", actionFilter);
    }

    const { data: logs, error } = await query;

    if (error) {
        console.error("Error fetching logs:", JSON.stringify(error, null, 2));
        return <div className="p-4 text-red-500">Failed to load logs.</div>;
    }

    // Fetch staff for name mapping
    const { data: staff } = await supabase.from("staff").select("user_id, name");

    // Convert to plain object for serialization to client component
    const staffMap: Record<string, string> = {};
    staff?.forEach((s) => {
        if (s.user_id) {
            staffMap[s.user_id] = s.name;
        }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Action Logs</h1>
                <LogFilter />
            </div>

            <LogsTable logs={logs || []} staffMap={staffMap} />
        </div>
    );
}
