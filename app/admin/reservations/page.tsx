import { createSupabaseServerClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Button } from "@/app/components/ui/Button";

export default async function AdminReservationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
    const supabase = createSupabaseServerClient();
    const resolvedParams = await searchParams;

    // Pagination logic
    const page = Number(resolvedParams.page) || 1;
    const pageSize = 10;
    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;

    // Fetch reservations with profiles and tables, paginated
    const { data: reservations, count, error } = await supabase
        .from("reservations")
        .select(`
            *,
            pool_table:pool_tables(name),
            profile:profiles(full_name)
        `, { count: 'exact' })
        .order("start_time", { ascending: false });
    // .range(start, end);

    // console.log("Admin Reservations Fetch:", { 
    //     count, 
    //     dataLength: reservations?.length, 
    //     error 
    // });

    if (error) {
        console.error("Error fetching reservations:", error);
    }

    const totalPages = count ? Math.ceil(count / pageSize) : 1;
    const hasNext = page < totalPages;
    const hasPrev = page > 1;

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Reservations</h1>
                    <p className="text-neutral-400">View and manage table bookings</p>
                </div>
                <div className="text-sm text-neutral-400">
                    Total: <span className="text-white font-bold">{count || 0}</span>
                </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-neutral-900/50 overflow-hidden">
                <table className="w-full text-left text-sm">
                    <thead className="bg-white/5 text-neutral-400 font-medium">
                        <tr>
                            <th className="px-4 py-3">Date & Time</th>
                            <th className="px-4 py-3">Customer</th>
                            <th className="px-4 py-3">Table</th>
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Payment</th>
                            <th className="px-4 py-3 text-right">Amount</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-neutral-300">
                        {(!reservations || reservations.length === 0) ? (
                            <tr>
                                <td colSpan={6} className="px-4 py-8 text-center text-neutral-500">
                                    No reservations found.
                                </td>
                            </tr>
                        ) : (
                            reservations.map((res: any) => (
                                <tr key={res.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-4 py-3">
                                        <div className="text-white font-medium">{format(new Date(res.start_time), "MMM d, yyyy")}</div>
                                        <div className="text-xs text-neutral-500 font-mono">
                                            {format(new Date(res.start_time), "h:mm a")} - {format(new Date(res.end_time), "h:mm a")}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-medium text-white">{res.profile?.full_name || "Unknown"}</div>
                                        {/* Email removed */}
                                    </td>
                                    <td className="px-4 py-3">
                                        {res.pool_table?.name || "Unknown Table"}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium 
                                            ${res.status === 'CONFIRMED' ? 'bg-emerald-500/10 text-emerald-400' :
                                                res.status === 'CANCELLED' ? 'bg-red-500/10 text-red-400' :
                                                    res.status === 'COMPLETED' ? 'bg-blue-500/10 text-blue-400' :
                                                        'bg-yellow-500/10 text-yellow-400'}`}>
                                            {res.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`text-xs ${res.payment_status === 'PAID' ? 'text-emerald-400' : 'text-neutral-500'}`}>
                                            {res.payment_status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-white">
                                        ₱{res.amount_paid}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between">
                <div className="text-sm text-neutral-500">
                    Page {page} of {totalPages}
                </div>
                <div className="flex gap-2">
                    <Link href={`/admin/reservations?page=${page - 1}`} className={hasPrev ? "" : "pointer-events-none"}>
                        <Button variant="outline" size="sm" disabled={!hasPrev}>
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                    </Link>
                    <Link href={`/admin/reservations?page=${page + 1}`} className={hasNext ? "" : "pointer-events-none"}>
                        <Button variant="outline" size="sm" disabled={!hasNext}>
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
