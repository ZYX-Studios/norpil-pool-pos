"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState, use, useRef } from "react";
import { format, addDays, addHours, isBefore, isSameDay } from "date-fns";
import { CalendarIcon, CreditCard, ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/app/components/ui/Button";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface Wallet {
    id: string;
    balance: number;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ReservationBookingPage(props: PageProps) {
    const params = use(props.params);
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryDate = searchParams.get("date");

    // Initialize with query date or today, normalised to start of day
    const [date, setDate] = useState<Date>(() => {
        const d = queryDate ? new Date(queryDate) : new Date();
        d.setHours(0, 0, 0, 0);
        return d;
    });

    const [table, setTable] = useState<any>(null); // any for now
    const [wallet, setWallet] = useState<Wallet | null>(null);
    const [reservations, setReservations] = useState<any[]>([]);
    const [selectedTime, setSelectedTime] = useState<string | null>(null);
    const [duration, setDuration] = useState(1);
    const [loading, setLoading] = useState(false);
    const [showConfirmation, setShowConfirmation] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [currentUser, setCurrentUser] = useState<any>(null);

    const supabase = createSupabaseBrowserClient();
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Generate next 14 days
    const days = Array.from({ length: 14 }, (_, i) => {
        const d = addDays(new Date(), i);
        d.setHours(0, 0, 0, 0);
        return d;
    });

    useEffect(() => {
        const fetchData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setCurrentUser(user);

            if (user) {
                const { data: walletData } = await supabase
                    .from("wallets")
                    .select("*")
                    .eq("profile_id", user.id)
                    .single();
                if (walletData) setWallet(walletData);
            }

            const tableId = (await params).id;
            if (tableId) {
                const { data: tableData } = await supabase
                    .from("pool_tables")
                    .select("*")
                    .eq("id", tableId)
                    .single();
                setTable(tableData);

                // Fetch reservations for this table on this date
                const startOfDay = new Date(date);
                startOfDay.setHours(0, 0, 0, 0);
                const endOfDay = new Date(date);
                endOfDay.setHours(23, 59, 59, 999);

                const { data: resData } = await supabase
                    .from("reservations")
                    .select("*")
                    .eq("pool_table_id", tableId)
                    .in("status", ["CONFIRMED", "PENDING"])
                    .gte("start_time", startOfDay.toISOString())
                    .lte("end_time", endOfDay.toISOString());

                setReservations(resData || []);
            }
        };
        fetchData();
    }, [params, date]);

    const handleDateSelect = (newDate: Date) => {
        const d = new Date(newDate);
        d.setHours(0, 0, 0, 0);
        setDate(d);
        setSelectedTime(null); // Reset selection

        // Update URL shallowly
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set("date", format(d, "yyyy-MM-dd"));
        router.replace(`?${newParams.toString()}`, { scroll: false });
    };

    const generateTimeSlots = () => {
        const slots = [];
        // Open from 10 AM to 10 PM
        for (let i = 10; i < 22; i++) {
            slots.push(`${i}:00`);
        }
        return slots;
    };

    const isSlotAvailable = (timeStr: string) => {
        const [startHours] = timeStr.split(":").map(Number);
        const slotStart = new Date(date);
        slotStart.setHours(startHours, 0, 0, 0);

        // We need to check if ALL slots for the duration are available
        for (let i = 0; i < duration; i++) {
            const checkStart = addHours(slotStart, i);
            const checkEnd = addHours(checkStart, 1);

            // Check if slot is in the past
            if (isBefore(checkStart, new Date())) return false;

            // Check overlap for this specific hour
            const hasOverlap = reservations.some(res => {
                const resStart = new Date(res.start_time);
                const resEnd = new Date(res.end_time);
                return (
                    (checkStart >= resStart && checkStart < resEnd) ||
                    (checkEnd > resStart && checkEnd <= resEnd)
                );
            });

            if (hasOverlap) return false;
        }

        // Also check if submitting would go beyond closing time (22:00)
        // If start is 21:00 and duration is 2 hours -> ends at 23:00 which is > 22:00
        // But maybe we allow playing past 10pm if they book at 9pm? 
        // Based on generateTimeSlots (10-22), let's assume 22:00 is closing.
        // If current logic allows booking 21:00 (ends 22:00), then booking 21:00 for 2 hours (ends 23:00) might be invalid if strict closing.
        // Let's assume strict closing at 22:00 for new bookings logic consistency? 
        // Or just let them book if slots exist.
        // The generateTimeSlots goes up to 21:00 (i < 22). 21:00-22:00 is last slot.
        // If duration is 2, and time is 21:00 -> 21:00-23:00.
        // Let's restrict to operating hours for now to be safe.
        // Last slot start is 21:00.
        const closingHour = 22;
        if (startHours + duration > closingHour) return false;

        return true;
    };

    const handleBook = async () => {
        if (!selectedTime || !wallet || !currentUser || !table) return;
        // Show confirmation dialog first
        setShowConfirmation(true);
    };

    const confirmBooking = async () => {
        setLoading(true);
        setShowConfirmation(false);

        const [hours] = selectedTime!.split(":").map(Number);
        const startTime = new Date(date);
        startTime.setHours(hours, 0, 0, 0);
        const endTime = addHours(startTime, duration);

        // Calculate amount (ensure it's a number)
        // @ts-ignore
        const amount = Number(table.hourly_rate) * duration;

        // @ts-ignore
        if (wallet.balance < amount) {
            alert("Insufficient wallet balance");
            setLoading(false);
            return;
        }

        // Expanded Debugging Logs
        const logError = (e: any) => {
            if (e && typeof e === 'object') {
                console.error("Full Error Object:", JSON.stringify(e, Object.getOwnPropertyNames(e)));
                console.error("Error Message:", e.message);
                console.error("Error Code:", e.code);
                console.error("Error Details:", e.details);
                console.error("Error Hint:", e.hint);
            } else {
                console.error("Error (Primitive):", e);
            }
        };

        const rpcParams = {
            p_user_id: currentUser.id,
            // @ts-ignore
            p_pool_table_id: table.id,
            p_start_time: startTime.toISOString(),
            p_end_time: endTime.toISOString(),
            p_guest_count: 1,
            p_amount: amount
        };
        console.log("Attempting RPC Call with params:", rpcParams);

        try {
            const { data, error } = await supabase.rpc("create_reservation_with_wallet", rpcParams);

            if (error) {
                console.error("Supabase RPC returned error:", error);
                throw error;
            }

            console.log("RPC Success:", data);

            if (data && data.success) {
                setShowSuccess(true);
                // Delay redirect to show success message
                setTimeout(() => {
                    router.push("/mobile/reservations");
                }, 2000);
            } else {
                alert(data?.message || "Booking failed");
            }
        } catch (err: any) {
            logError(err);
            alert(`Booking failed: ${err.message || 'Unknown error. Check console.'}`);
        } finally {
            setLoading(false);
        }
    };

    const timeSlots = generateTimeSlots();

    if (!table) return (
        <div className="flex items-center justify-center min-h-[60vh] bg-neutral-950">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-neutral-950 pb-24">
            {/* Header */}
            <div className="sticky top-0 z-10 bg-neutral-900/80 backdrop-blur-md border-b border-white/5 px-4 py-4">
                <div className="container mx-auto max-w-2xl flex items-center relative">
                    <Link href="/mobile/reservations" className="absolute left-0 p-2 rounded-full hover:bg-white/5 text-neutral-400 hover:text-white transition-colors">
                        <ChevronLeft className="h-6 w-6" />
                    </Link>
                    <h1 className="flex-1 text-center font-bold text-neutral-100 text-lg">Confirm Booking</h1>
                </div>
            </div>

            <div className="container mx-auto px-4 py-6 max-w-2xl mt-4">
                <div className="bg-neutral-900/60 border border-white/10 rounded-3xl overflow-hidden shadow-2xl">
                    <div className="p-6 sm:p-8 space-y-8">
                        {/* Table Details */}
                        <div className="text-center space-y-2">
                            {/* @ts-ignore */}
                            <h2 className="text-3xl font-bold text-white font-serif tracking-tight">{table.name}</h2>
                            <p className="text-neutral-400 text-sm">Select a date and time to reserve</p>
                        </div>

                        {/* Date Selection */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between px-1">
                                <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                                    Date
                                </label>
                                <div className="relative">
                                    <div className="flex items-center gap-2 text-amber-500 font-medium text-sm">
                                        <CalendarIcon className="h-4 w-4" />
                                        <span>{format(date, "MMM d, yyyy")}</span>
                                    </div>
                                    <input
                                        type="date"
                                        value={format(date, "yyyy-MM-dd")}
                                        min={new Date().toISOString().split('T')[0]}
                                        onChange={(e) => handleDateSelect(new Date(e.target.value))}
                                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                        aria-label="Choose custom date"
                                    />
                                </div>
                            </div>

                            {/* Horizontal Scroll Strip */}
                            <div
                                ref={scrollContainerRef}
                                className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 scrollbar-hide snap-x snap-mandatory"
                            >
                                {days.map((day) => {
                                    const isSelected = isSameDay(date, day);
                                    return (
                                        <button
                                            key={day.toString()}
                                            onClick={() => handleDateSelect(day)}
                                            className={cn(
                                                "flex flex-col items-center justify-center min-w-[72px] h-[84px] rounded-2xl border transition-all duration-300 snap-center shrink-0",
                                                isSelected
                                                    ? "bg-amber-500 border-amber-400 text-neutral-900 shadow-[0_0_15px_rgba(245,158,11,0.4)] scale-105"
                                                    : "bg-white/5 border-white/10 text-neutral-400 hover:bg-white/10 hover:border-white/20"
                                            )}
                                        >
                                            <span className={cn("text-xs font-medium uppercase", isSelected ? "text-neutral-800" : "text-neutral-500")}>
                                                {format(day, "EEE")}
                                            </span>
                                            <span className={cn("text-2xl font-bold mt-1", isSelected ? "text-neutral-900" : "text-neutral-200")}>
                                                {format(day, "d")}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">Duration</h3>
                                <div className="flex bg-neutral-800/50 p-1 rounded-lg border border-white/5">
                                    {[1, 2, 3].map((d) => (
                                        <button
                                            key={d}
                                            onClick={() => {
                                                setDuration(d);
                                                setSelectedTime(null);
                                            }}
                                            className={cn(
                                                "px-3 py-1 rounded-md text-xs font-bold transition-all",
                                                duration === d
                                                    ? "bg-amber-500 text-neutral-900 shadow-lg"
                                                    : "text-neutral-400 hover:text-white"
                                            )}
                                        >
                                            {d}h
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-white/5" />

                        {/* Time Slots */}
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider text-center">Select Start Time</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                {timeSlots.map(time => {
                                    const available = isSlotAvailable(time);
                                    const isSelected = selectedTime === time;
                                    return (
                                        <button
                                            key={time}
                                            disabled={!available}
                                            onClick={() => setSelectedTime(time)}
                                            className={cn(
                                                "relative px-2 py-3 rounded-xl text-sm font-medium transition-all duration-200 border",
                                                isSelected
                                                    ? "bg-amber-500 text-neutral-900 border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)] transform scale-[1.02]"
                                                    : available
                                                        ? "bg-neutral-800/50 text-neutral-300 border-white/5 hover:bg-neutral-800 hover:border-white/20"
                                                        : "bg-neutral-900/30 text-neutral-700 border-transparent cursor-not-allowed"
                                            )}
                                        >
                                            {time}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>

                        {selectedTime && (
                            <div className="animate-in slide-in-from-bottom-4 fade-in duration-300">
                                <div className="mt-8 bg-neutral-950/50 rounded-2xl p-5 border border-white/5 space-y-4">
                                    <div className="flex justify-between items-center pb-4 border-b border-white/5">
                                        <span className="text-neutral-400 font-medium">Total for {duration} hour{duration > 1 ? 's' : ''}</span>
                                        {/* @ts-ignore */}
                                        <span className="text-2xl font-bold text-white">₱{Number(table.hourly_rate) * duration}</span>
                                    </div>

                                    {wallet ? (
                                        <div className="space-y-4">
                                            <div className="flex justify-between items-center">
                                                <div className="flex items-center gap-2 text-neutral-300">
                                                    <CreditCard className="h-4 w-4 text-emerald-400" />
                                                    <span className="text-sm">Wallet Balance</span>
                                                </div>
                                                <span className={cn(
                                                    "font-mono font-medium",
                                                    // @ts-ignore
                                                    wallet.balance < (table.hourly_rate * duration) ? "text-red-400" : "text-emerald-400"
                                                )}>
                                                    ₱{wallet.balance.toFixed(2)}
                                                </span>
                                            </div>

                                            {/* @ts-ignore */}
                                            {wallet.balance < (table.hourly_rate * duration) && (
                                                <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                                                    <p className="text-red-400 text-sm font-medium">Insufficient Funds</p>
                                                </div>
                                            )}

                                            <Button
                                                className="w-full h-12 text-base font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-neutral-900 shadow-lg shadow-amber-900/20 border-0"
                                                onClick={handleBook}
                                                // @ts-ignore
                                                disabled={loading || wallet.balance < (table.hourly_rate * duration)}
                                            >
                                                {/* @ts-ignore */}
                                                {loading ? "Processing..." : "Confirm & Pay"}
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <Link href="/auth/login" className="text-amber-500 hover:underline">Log in to pay</Link>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirmation Modal */}
            {showConfirmation && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-sm w-full p-6 space-y-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-bold text-white">Confirm Reservation</h3>
                            <p className="text-neutral-400 text-sm">
                                You are about to book <span className="text-amber-400 font-medium">{(table as any)?.name}</span> for
                                <br />
                                <span className="text-white font-medium">{format(date, "MMM d")} at {selectedTime} ({duration} hrs)</span>
                            </p>
                            <div className="bg-white/5 rounded-xl p-4 mt-4">
                                <span className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">Total Payment</span>
                                <span className="text-2xl font-bold text-white">₱{(table as any)?.hourly_rate * duration}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <Button variant="outline" onClick={() => setShowConfirmation(false)}>Cancel</Button>
                            <Button
                                className="bg-amber-500 hover:bg-amber-600 text-neutral-950 font-bold"
                                onClick={confirmBooking}
                            >
                                Pay Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Success Modal */}
            {showSuccess && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
                    <div className="bg-neutral-900/50 border border-emerald-500/30 rounded-full p-8 flex flex-col items-center justify-center space-y-4 shadow-[0_0_50px_rgba(16,185,129,0.2)]">
                        <div className="rounded-full bg-emerald-500/20 p-4 animate-in zoom-in duration-500">
                            <CreditCard className="h-12 w-12 text-emerald-400" />
                        </div>
                        <h3 className="text-2xl font-bold text-white animate-in slide-in-from-bottom-4 fade-in duration-500 delay-150">Confirmed!</h3>
                        <p className="text-emerald-400/80 animate-in slide-in-from-bottom-4 fade-in duration-500 delay-300">Redirecting...</p>
                    </div>
                </div>
            )}
        </div>
    );
}
