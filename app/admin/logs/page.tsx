import { createSupabaseServerClient } from "@/lib/supabase/server";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function LogsPage() {
    const supabase = createSupabaseServerClient();

    // Fetch logs
    const { data: logs, error } = await supabase
        .from("action_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

    if (error) {
        console.error("Error fetching logs:", JSON.stringify(error, null, 2));
        return <div className="p-4 text-red-500">Failed to load logs.</div>;
    }

    // Fetch staff for name mapping
    const { data: staff } = await supabase.from("staff").select("user_id, name");
    const staffMap = new Map(staff?.map((s) => [s.user_id, s.name]) || []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">Action Logs</h1>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                <table className="w-full text-left text-sm text-neutral-400">
                    <thead className="bg-white/5 text-neutral-200">
                        <tr>
                            <th className="px-4 py-3 font-medium">Time</th>
                            <th className="px-4 py-3 font-medium">User</th>
                            <th className="px-4 py-3 font-medium">Action</th>
                            <th className="px-4 py-3 font-medium">Entity</th>
                            <th className="px-4 py-3 font-medium">Details</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {logs?.map((log) => (
                            <tr key={log.id} className="hover:bg-white/5">
                                <td className="whitespace-nowrap px-4 py-3">
                                    {format(new Date(log.created_at), "MMM d, HH:mm:ss")}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    {log.user_id ? staffMap.get(log.user_id) || "Unknown" : "System/Guest"}
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    <span className="rounded bg-white/10 px-2 py-1 text-xs font-medium text-white">
                                        {log.action_type}
                                    </span>
                                </td>
                                <td className="whitespace-nowrap px-4 py-3">
                                    {log.entity_type} {log.entity_id ? `(${log.entity_id.slice(0, 8)}...)` : ""}
                                </td>
                                <td className="px-4 py-3 font-mono text-xs text-neutral-500 max-w-xs truncate" title={JSON.stringify(log.details, null, 2)}>
                                    {log.details ? JSON.stringify(log.details) : "-"}
                                </td>
                            </tr>
                        ))}
                        {(!logs || logs.length === 0) && (
                            <tr>
                                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                                    No logs found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
