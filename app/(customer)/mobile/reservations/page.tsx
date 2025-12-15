"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { format, isAfter, isToday } from "date-fns";
import { Users, Clock, Calendar as CalendarIcon, ChevronRight, Ticket, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export default function ReservationsPage() {
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [tables, setTables] = useState<any[]>([]);
    const [myReservations, setMyReservations] = useState<any[]>([]);
    const [loadingReservations, setLoadingReservations] = useState(true);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        const fetchTables = async () => {
            const { data } = await supabase
                .from("pool_tables")
                .select("*")
                .eq("is_active", true)
                .is("deleted_at", null)
                .order("name");

            if (data) {
                // Double check filter just in case
                const activeTables = data.filter(t => !t.deleted_at);
                setTables(activeTables);
            }
        };

        const fetchMyReservations = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoadingReservations(false);
                return;
            }

            const now = new Date();
            // Fetch reservations where end_time is in the future (upcoming)
            const { data } = await supabase
                .from("reservations")
                .select(`
                    *,
                    pool_table:pool_tables(name),
                    table_sessions(id, closed_at, opened_at)
                `)
                .eq("profile_id", user.id)
                .in("status", ["CONFIRMED", "PENDING"]) // Removed INVALID 'PAID' status
                .gte("end_time", now.toISOString())
                .order("start_time", { ascending: true });

            if (data) {
                setMyReservations(data);
            }
            setLoadingReservations(false);
        };

        fetchTables();
        fetchMyReservations();
    }, []);

    // Helper to format reservation time
    const getResDate = (isoString: string) => new Date(isoString);

    return (
        <div className="pb-24">
            {/* Header */}
            <div className="relative overflow-hidden bg-neutral-900/60 backdrop-blur-md border-b border-white/5 px-6 py-8">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 via-transparent to-transparent opacity-50" />
                <div className="relative z-10">
                    <h1 className="text-3xl font-bold text-neutral-50 mb-2 font-serif tracking-tight">
                        Reserve a Table
                    </h1>
                    <p className="text-neutral-400 max-w-sm text-sm leading-relaxed">
                        Book your premium pool experience. Select a date and table to get started.
                    </p>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 max-w-3xl space-y-8">

                {/* My Reservations Section */}
                {!loadingReservations && myReservations.length > 0 && (
                    <div className="animate-in slide-in-from-bottom-4 fade-in duration-500">
                        <div className="flex items-center gap-2 mb-4">
                            <Ticket className="h-4 w-4 text-emerald-400" />
                            <h2 className="text-sm font-bold text-white uppercase tracking-wider">Your Upcoming Bookings</h2>
                        </div>
                        <div className="grid gap-3">
                            {myReservations.map((res) => {
                                const startDate = getResDate(res.start_time);
                                // Check if there is an active session for this reservation
                                const activeSession = res.table_sessions?.find((s: any) => !s.closed_at);
                                const isPlaying = !!activeSession;

                                return (
                                    <div key={res.id} className={cn(
                                        "relative overflow-hidden rounded-2xl border p-5 shadow-lg transition-all",
                                        isPlaying
                                            ? "bg-emerald-900/20 border-emerald-500/50 shadow-emerald-900/20"
                                            : "bg-neutral-900/80 border-emerald-500/20 shadow-emerald-900/10"
                                    )}>
                                        {isPlaying && (
                                            <div className="absolute top-0 right-0 px-3 py-1 bg-emerald-500 text-black text-[10px] font-bold uppercase tracking-wider rounded-bl-xl">
                                                Playing Now
                                            </div>
                                        )}
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={cn(
                                                        "font-bold text-lg",
                                                        isPlaying ? "text-white" : "text-emerald-400"
                                                    )}>
                                                        {(res.pool_table as any)?.name}
                                                    </span>
                                                    {!isPlaying && isToday(startDate) && (
                                                        <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/20">
                                                            TODAY
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-neutral-300 text-sm font-medium flex items-center gap-2">
                                                    <span>{format(startDate, "MMM d, yyyy")}</span>
                                                    <span className="text-neutral-600">•</span>
                                                    <span>{format(startDate, "h:mm a")}</span>
                                                    {isPlaying && activeSession.opened_at && (
                                                        <span className="text-emerald-400 text-xs ml-1">(Started {format(new Date(activeSession.opened_at), "h:mm a")})</span>
                                                    )}
                                                </div>
                                            </div>
                                            {!isPlaying && (
                                                <div className="bg-emerald-500/10 p-2 rounded-full">
                                                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                        <div className="h-px bg-white/5 my-8" />
                    </div>
                )}


                {/* Date Selection */}
                <div>
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3 ml-1">
                        Select Date
                    </label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <CalendarIcon className="h-5 w-5 text-amber-500" />
                        </div>
                        <input
                            type="date"
                            value={date}
                            min={new Date().toISOString().split('T')[0]}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-neutral-900/50 text-white rounded-2xl border border-white/10 pl-11 pr-4 py-4 shadow-sm focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 focus:outline-none transition-all appearance-none"
                        />
                    </div>
                </div>

                {/* Tables Grid */}
                <div className="space-y-4">
                    {tables.map((table) => (
                        <Link
                            key={table.id}
                            href={`/mobile/reservations/${table.id}?date=${date}`}
                            className="block group"
                        >
                            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-900/60 p-5 transition-all duration-300 hover:bg-neutral-900/80 hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-900/10">
                                {/* Hover Effect Background */}
                                <div className="absolute inset-0 bg-gradient-to-r from-amber-500/0 via-amber-500/0 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                                <div className="relative flex items-center justify-between">
                                    <div className="flex-1 min-w-0 pr-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <h3 className="text-lg font-bold text-neutral-50 truncate group-hover:text-amber-500 transition-colors">
                                                {table.name}
                                            </h3>
                                            <div className="px-2.5 py-1 bg-neutral-800 rounded-lg border border-white/5">
                                                <span className="text-amber-500 font-bold text-sm">₱{table.hourly_rate}</span>
                                                <span className="text-neutral-500 text-xs ml-0.5">/hr</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4 text-sm text-neutral-400 mt-3">
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                                                <Users className="h-3.5 w-3.5 text-neutral-500" />
                                                <span className="text-xs">Max 4</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 bg-white/5 px-2 py-1 rounded-md">
                                                <Clock className="h-3.5 w-3.5 text-neutral-500" />
                                                <span className="text-xs">All Day</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 text-neutral-400 group-hover:bg-amber-500 group-hover:text-neutral-900 transition-all transform group-hover:translate-x-1">
                                        <ChevronRight className="h-5 w-5" />
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}

                    {tables.length === 0 && (
                        <div className="text-center py-12">
                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-neutral-900 mb-4">
                                <Clock className="h-6 w-6 text-neutral-600" />
                            </div>
                            <p className="text-neutral-500">No tables available perfectly right now.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
