import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getReportData } from "@/app/admin/reports/data";
import { Card } from "@/app/components/ui/Card";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, Users, MonitorPlay, Activity } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function OwnerDashboard() {
    const supabase = createSupabaseServerClient();

    // 1. Get Today's Date Range (Manila Time)
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = { timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit" };
    const formatter = new Intl.DateTimeFormat("en-CA", options);
    const today = formatter.format(now);

    // Determine Operational ID dates:
    // If now < 10am, we are in "Yesterday's Business Day". 
    // But to find "revenue for THIS shift context", we usually want the dashboard to slide.
    // If 2 AM Dec 30 -> Operational Day is Dec 29. Range [Dec 29 10am, Dec 30 10am].
    // If 2 PM Dec 30 -> Operational Day is Dec 30. Range [Dec 30 10am, Dec 31 10am].
    // To support accurate filtering, we need to fetch enough data.
    // Fetching [Today - 1, Today + 1] is safest? 
    // Or just [OperationalDate, OperationalDate + 1].

    // Let's compute Operational Date first (Server Side)
    // Note: `now` is server time? We need Manila Time.
    // We used `formatter` to get YYYY-MM-DD in Manila.
    // But `now.getHours()` is UTC on server (usually). We need Manila Hour.
    const manilaTimeStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Manila" });
    const manilaDate = new Date(manilaTimeStr);
    const currentHourManila = manilaDate.getHours();

    let opDate = new Date(manilaDate);
    if (currentHourManila < 10) {
        opDate.setDate(opDate.getDate() - 1);
    }
    const opDateStr = formatter.format(opDate); // YYYY-MM-DD

    // Next Day for Range End
    const nextDate = new Date(opDate);
    nextDate.setDate(nextDate.getDate() + 1);
    const nextDateStr = formatter.format(nextDate);

    // 2. Fetch Financial Data (Reuse Admin Reports Logic)
    // Fetch [OperationalDate, NextDate] to cover the 10am-10am crossover fully
    const reportData = await getReportData(opDateStr, nextDateStr, supabase);
    // Note: The `reportData.total` will be for TWO DAYS now. We must ignore it and use our calculated `businessDayRevenue`.
    const transactionCount = reportData.tx?.length ?? 0;

    // 3. Fetch Operational Data (Active Tables, etc.)
    const { data: activeSessions } = await supabase
        .from("table_sessions")
        .select(`
            id, 
            pool_table_id, 
            opened_by, 
            customer_name, 
            opened_at, 
            paused_at,
            accumulated_paused_time,
            override_hourly_rate,
            location_name,
            session_type,
            target_duration_minutes,
            is_money_game,
            bet_amount,
            pool_tables!table_sessions_pool_table_id_fkey(name, hourly_rate),
            orders(
                id,
                total,
                status,
                order_items(line_total)
            )
        `)
        .eq("status", "OPEN")
        .order("opened_at", { ascending: false });

    // 4. Fetch Active Staff (Open Cashier Shifts)
    const { data: activeShifts } = await supabase
        .from("cashier_shifts")
        .select("id, created_by")
        .is("ended_at", null);

    // Note: The relationship staff:created_by needs to exist. 
    // If it doesn't, we might need to fetch staff separately or assume `staff` table has a foreign key to `auth.users` via `user_id`.
    // Actually, usually `created_by` is the auth.uid. `staff.user_id` is also auth.uid.
    // If there is no direct FK from cashier_shifts.created_by to staff, we can't join easily.
    // Let's try to fetch staff names manually for safety.

    const activeStaffIds = activeShifts?.map(s => s.created_by).filter(Boolean) ?? [];
    let staffNames: string[] = [];

    if (activeStaffIds.length > 0) {
        const { data: staffMembers } = await supabase
            .from("staff")
            .select("name")
            .in("user_id", activeStaffIds); // Assuming staff.user_id matches created_by (auth.uid)

        staffNames = staffMembers?.map(s => s.name).filter(Boolean) as string[] ?? [];
    }

    const activeStaffCount = staffNames.length > 0 ? staffNames.length : (activeShifts?.length ?? 0);
    const staffLabel = staffNames.length > 0 ? staffNames.join(", ") : "Currently clocked in";

    // 5. Pre-process Sessions for KPIs and List
    // We do this here so we can use the stats in the cards
    const processedSessions = (activeSessions || []).map((session: any) => {
        // Calculate Effective Duration (accounting for pauses)
        const start = new Date(session.opened_at).getTime();
        const nowMs = now.getTime();
        const accumulatedPaused = (session.accumulated_paused_time || 0) * 1000;

        let elapsedMs = 0;
        if (session.paused_at) {
            elapsedMs = new Date(session.paused_at).getTime() - start - accumulatedPaused;
        } else {
            elapsedMs = nowMs - start - accumulatedPaused;
        }

        const validElapsedMs = Math.max(0, elapsedMs);
        const diffMins = Math.floor(validElapsedMs / 60000);
        const hrs = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const durationStr = `${hrs}h ${mins}m`;

        // Calculate Product Total
        let productBill = 0;
        if (session.orders) {
            session.orders.forEach((order: any) => {
                if (['OPEN', 'PREPARING', 'READY', 'SERVED'].includes(order.status)) {
                    if (order.order_items) {
                        order.order_items.forEach((item: any) => {
                            productBill += item.line_total || 0;
                        });
                    }
                }
            });
        }

        // Calculate Table Fee (Exact POS Logic)
        let tableFee = 0;
        if (session.pool_table_id) {
            const rate = session.override_hourly_rate ?? (session.pool_tables as any)?.hourly_rate ?? 0;
            const elapsedMinutes = Math.floor(validElapsedMs / 60000);

            if (session.session_type === "FIXED" && session.target_duration_minutes) {
                // Fixed Time Logic
                const baseFee = (session.target_duration_minutes / 60) * rate;
                const excessMinutes = Math.max(0, elapsedMinutes - session.target_duration_minutes);
                const excessFee = excessMinutes * (rate / 60);
                tableFee = baseFee + excessFee;
            } else {
                // Open Time Logic (Default): 30 min blocks
                if (elapsedMinutes > 5) {
                    const blocks = Math.ceil(elapsedMinutes / 30);
                    tableFee = blocks * 0.5 * rate;
                }
            }

            // Money Game Logic
            if (session.is_money_game && session.bet_amount) {
                const minimumFee = session.bet_amount * 0.10;
                tableFee = Math.max(tableFee, minimumFee);
            }
        }

        const totalEst = productBill + tableFee;
        const tableName = (session.pool_tables as any)?.name || session.location_name || "Walk-in";
        const isWalkIn = !session.pool_table_id;

        return { ...session, durationStr, productBill, totalEst, tableName, isWalkIn };
    });

    const activeTablesList = processedSessions.filter(s => !s.isWalkIn);
    const activeWalkInsList = processedSessions.filter(s => s.isWalkIn);
    const walkInsUnsettledTotal = activeWalkInsList.reduce((acc, curr) => acc + curr.totalEst, 0);

    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">Welcome Back, Owner.</h1>
                <p className="text-neutral-400 mt-2">Here is your store's performance for <span className="text-emerald-400 font-medium">{formatter.format(opDate)}</span>.</p>
            </div>

            {/* KPI Grid */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {/* Replaced by dynamic cards below */}
                <StatsCard
                    title="Active Tables"
                    value={activeTablesList.length.toString()}
                    icon={MonitorPlay}
                    color="blue"
                    description="Currently occupied"
                />
                <StatsCard
                    title="Active Walk-ins"
                    value={activeWalkInsList.length.toString()}
                    icon={Activity}
                    color="amber"
                    description={`Unsettled: ${formatCurrency(walkInsUnsettledTotal)}`}
                />

                {/* Current Shift Card */}
                {(() => {
                    // Logic to determine current and previous shift stats
                    // Shift definition: Day 10am-6pm, Night 6pm-3am
                    const currentHour = now.getHours();
                    let currentShiftName = "Night Shift";
                    let currentShiftStartHour = 18; // 6pm
                    let previousShiftStartHour = 10; // 10am
                    let previousShiftEndHour = 18;
                    let previousShiftName = "Day Shift";

                    // If between 10am and 6pm, it's Day Shift
                    if (currentHour >= 10 && currentHour < 18) {
                        currentShiftName = "Day Shift";
                        currentShiftStartHour = 10;
                        previousShiftStartHour = 18; // Yesterday 6pm
                        previousShiftEndHour = 3;  // Yesterday 3am (technically ends today 3am)
                        previousShiftName = "Night Shift (Prev)";
                    }

                    // Calculate Current Shift Sales
                    const currentShiftStart = new Date(now);
                    currentShiftStart.setHours(currentShiftStartHour, 0, 0, 0);
                    // Special case: if it's Night Shift (after midnight 00:00 - 04:00), start is Yesterday 18:00
                    if (currentShiftName === "Night Shift" && currentHour < 10) {
                        currentShiftStart.setDate(currentShiftStart.getDate() - 1);
                    }

                    const currentShiftSales = (reportData.tx || [])
                        .filter((tx: any) => {
                            const txTime = new Date(tx.paid_at).getTime();
                            return txTime >= currentShiftStart.getTime();
                        })
                        .reduce((acc: number, tx: any) => acc + (tx.amount || 0), 0);

                    // Calculate Previous Shift Sales (Approximate based on today's data or full fetch needs? 
                    // ReportData `tx` only has *Today's* transactions (00:00 - 23:59).
                    // If we are in Day Shift (10am-6pm), Previous Night Shift was Yesterday 6pm - Today 3am. 
                    //    We only have Today 00:00 - Today 3am in `reportData.tx`. verify?
                    //    `getReportData` fetches `today` as start/end. 
                    //    So if we are in Day Shift, we are missing Yesterday 6pm-Midnight part of the prev shift.
                    //    If we are in Night Shift (say 8pm), Previous Day Shift was Today 10am-6pm. All in `reportData.tx`!

                    // Limitation: If current shift is Day Shift, 'Previous Shift' (Night) data is incomplete in `reportData`.
                    // We will handle what we can:
                    // If Night Shift (now): Previous = Today 10am-6pm. Fully available.
                    // If Day Shift (now): Previous = Yesterday 18:00 - Today 03:00. Partial (Today 00:00-03:00) available.
                    // For the "Day Shift" case, illustrating "Last Night (since midnight)" might be the safe fallback without extra fetch.

                    // Let's implement robust filtering for what we HAVE.
                    const isNightNow = currentShiftName === "Night Shift";

                    let prevShiftSales = 0;
                    if (isNightNow) {
                        // Previous is Day Shift Today (10-18)
                        prevShiftSales = (reportData.tx || [])
                            .filter((tx: any) => {
                                const h = new Date(tx.paid_at).getHours();
                                return h >= 10 && h < 18;
                            })
                            .reduce((acc: number, tx: any) => acc + (tx.amount || 0), 0);
                    } else {
                        // Current is Day Shift. Previous was Night Shift (Last night).
                        // We only have Today's data (since 00:00).
                        // So we can show "Night Shift (Since 12am)".
                        previousShiftName = "Night Shift (12am-3am)";
                        prevShiftSales = (reportData.tx || [])
                            .filter((tx: any) => {
                                const h = new Date(tx.paid_at).getHours();
                                return h < 4; // 00:00 to 03:59
                            })
                            .reduce((acc: number, tx: any) => acc + (tx.amount || 0), 0);
                    }

                    // 1. Define Business Day Window (10am - 10am)
                    const opStart = new Date(opDate);
                    opStart.setHours(10, 0, 0, 0);

                    const opEnd = new Date(nextDate);
                    opEnd.setHours(10, 0, 0, 0);

                    // 2. Filter for Total Business Day Revenue
                    const businessDayTx = (reportData.tx || []).filter((tx: any) => {
                        const t = new Date(tx.paid_at).getTime();
                        return t >= opStart.getTime() && t < opEnd.getTime();
                    });
                    const businessDayRevenue = businessDayTx.reduce((acc: number, tx: any) => acc + (tx.amount || 0), 0);

                    return (
                        <>
                            <StatsCard
                                title="Total Revenue (Biz Day)"
                                value={formatCurrency(businessDayRevenue)}
                                icon={TrendingUp}
                                color="emerald"
                                description={`${formatter.format(opDate)}`}
                            />
                            <StatsCard
                                title={`Current: ${currentShiftName}`}
                                value={formatCurrency(currentShiftSales)}
                                icon={Activity}
                                color="amber"
                                description={`${isNightNow ? 'Since 6PM' : 'Since 10AM'}`}
                            />
                            <StatsCard
                                title={`Prev: ${previousShiftName}`}
                                value={formatCurrency(prevShiftSales)}
                                icon={TrendingUp}
                                color="violet"
                                description={isNightNow ? "Today 10am-6pm" : "Today 12am-3am only"}
                            />
                        </>
                    );
                })()}

                <StatsCard
                    title="Active Staff"
                    value={activeStaffCount.toString()}
                    icon={Users}
                    color="emerald"
                    description={staffLabel}
                />
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
                {/* Recent Transactions List */}
                <Card className="p-6 bg-neutral-900/50 border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-white">Recent Transactions</h3>
                        <Link href="/admin/transactions" className="text-xs text-emerald-400 hover:text-emerald-300">View All</Link>
                    </div>
                    <div className="space-y-4">
                        {reportData.tx && reportData.tx.length > 0 ? (
                            reportData.tx.slice(0, 5).map((tx: any) => (
                                <div key={tx.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors">
                                    <div className="flex flex-col">
                                        <span className="text-sm font-medium text-white">
                                            {tx.orders?.table_sessions?.pool_tables?.name || "Order"}
                                            {tx.orders?.table_sessions?.customer_name ? ` - ${tx.orders.table_sessions.customer_name}` : ""}
                                        </span>
                                        <span className="text-xs text-neutral-400">
                                            {new Date(tx.paid_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {tx.method}
                                        </span>
                                    </div>
                                    <div className="font-bold text-emerald-400">
                                        +{formatCurrency(tx.amount)}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="text-center text-neutral-500 py-8">No transactions yet today.</div>
                        )}
                    </div>
                </Card>

                {/* Active Tables & Walk-ins */}
                <Card className="p-6 bg-neutral-900/50 border-white/5">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-lg text-white">Live Operations</h3>
                        <Link href="/pos" className="text-xs text-blue-400 hover:text-blue-300">Go to POS</Link>
                    </div>

                    {(() => {
                        const SessionRow = ({ s }: { s: any }) => (
                            <div className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/5 px-2 -mx-2 rounded transition-colors group">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-white">{s.tableName}</span>
                                        {s.customer_name && (
                                            <span className="text-sm text-neutral-400 font-normal">
                                                — {s.customer_name}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-xs text-neutral-500 font-mono group-hover:text-neutral-400">
                                        Open for {s.durationStr}
                                    </span>
                                </div>
                                <div className="text-right">
                                    <div className="font-bold text-emerald-400">
                                        {formatCurrency(s.totalEst)}
                                    </div>
                                    <div className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">
                                        {s.isWalkIn ? 'Current Bill' : 'Est. Total'}
                                    </div>
                                </div>
                            </div>
                        );

                        return (
                            <div className="space-y-8">
                                {/* Active Tables Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Active Tables ({activeTablesList.length})</h4>
                                    <div className="space-y-1">
                                        {activeTablesList.length > 0 ? (
                                            activeTablesList.map(s => <SessionRow key={s.id} s={s} />)
                                        ) : (
                                            <div className="text-sm text-neutral-600 italic py-2">No active tables.</div>
                                        )}
                                    </div>
                                </div>

                                {/* Walk-ins Section */}
                                <div>
                                    <h4 className="text-xs font-bold text-neutral-500 uppercase tracking-wider mb-3">Walk-ins ({activeWalkInsList.length})</h4>
                                    <div className="space-y-1">
                                        {activeWalkInsList.length > 0 ? (
                                            activeWalkInsList.map(s => <SessionRow key={s.id} s={s} />)
                                        ) : (
                                            <div className="text-sm text-neutral-600 italic py-2">No active walk-ins.</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </Card>
            </div>
        </div>
    );
}

function StatsCard({ title, value, icon: Icon, color, description }: {
    title: string;
    value: string;
    icon: any;
    color: "emerald" | "blue" | "violet" | "amber";
    description?: string;
}) {
    const colorStyles = {
        emerald: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20",
        blue: "text-blue-400 bg-blue-400/10 border-blue-400/20",
        violet: "text-violet-400 bg-violet-400/10 border-violet-400/20",
        amber: "text-amber-400 bg-amber-400/10 border-amber-400/20",
    };

    return (
        <Card className="p-6 bg-neutral-900/50 border-white/5 hover:border-white/10 transition-colors">
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm font-medium text-neutral-400">{title}</p>
                    <h3 className="text-2xl font-bold text-white mt-2 tracking-tight">{value}</h3>
                    {description && <p className="text-xs text-neutral-500 mt-1">{description}</p>}
                </div>
                <div className={`p-3 rounded-xl border ${colorStyles[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
        </Card>
    );
}
