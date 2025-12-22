import { createSupabaseServerClient } from "@/lib/supabase/server";
import LogsTable from "./LogsTable";
import LogFilter from "./LogFilter";
import LogsPagination from "./LogsPagination";
import { DateRangePicker } from "@/app/components/ui/DateRangePicker";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

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
    const searchFilter = typeof params?.search === 'string' ? params.search : null;
    const startDate = typeof params?.start === 'string' ? params.start : null;
    const endDate = typeof params?.end === 'string' ? params.end : null;

    const pageParam = typeof params?.page === 'string' ? parseInt(params.page) : 1;
    const currentPage = isNaN(pageParam) || pageParam < 1 ? 1 : pageParam;

    // Build Query
    let query = supabase
        .from("action_logs")
        .select("*", { count: "exact" });

    // Apply Filters
    if (actionFilter) {
        query = query.eq("action_type", actionFilter);
    }

    if (searchFilter) {
        // Search in entity_id
        query = query.ilike('entity_id', `%${searchFilter}%`);
    }

    if (startDate) {
        query = query.gte("created_at", `${startDate}T00:00:00`);
    }
    if (endDate) {
        query = query.lte("created_at", `${endDate}T23:59:59`);
    }

    // Apply Pagination
    const from = (currentPage - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    query = query.order("created_at", { ascending: false }).range(from, to);

    const { data: logs, error, count } = await query;

    if (error) {
        console.error("Error fetching logs:", JSON.stringify(error, null, 2));
        return <div className="p-4 text-red-500">Failed to load logs.</div>;
    }

    const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;

    // Fetch staff for name mapping
    const { data: staff } = await supabase.from("staff").select("user_id, name");

    // Convert to plain object for serialization to client component
    const staffMap: Record<string, string> = {};
    staff?.forEach((s) => {
        if (s.user_id) {
            staffMap[s.user_id] = s.name;
        }
    });

    // Default dates for picker if not set
    const now = new Date();
    const defaultStart = startDate || new Date(now.setDate(now.getDate() - 7)).toISOString().split('T')[0];
    const defaultEnd = endDate || new Date().toISOString().split('T')[0];


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h1 className="text-2xl font-bold text-white">Action Logs</h1>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    <DateRangePicker defaultStart={defaultStart} defaultEnd={defaultEnd} />
                    <LogFilter />
                </div>
            </div>

            <div className="space-y-4">
                <LogsTable logs={logs || []} staffMap={staffMap} />
                <LogsPagination
                    currentPage={currentPage}
                    totalPages={totalPages}
                    hasNextPage={currentPage < totalPages}
                    hasPrevPage={currentPage > 1}
                />
            </div>
        </div>
    );
}
