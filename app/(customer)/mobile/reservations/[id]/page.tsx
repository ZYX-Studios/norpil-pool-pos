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
    const [memberDiscountPercent, setMemberDiscountPercent] = useState(0);
    const [tierName, setTierName] = useState<string | null>(null);

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

            let effectiveDiscount = 0;
            let currentTierName = null;

            if (user) {
                // Fetch Wallet (original trusted method)
                const { data: walletData } = await supabase
                    .from("wallets")
                    .select("*")
                    .eq("profile_id", user.id)
                    .single();
                if (walletData) setWallet(walletData);

                // Fetch Profile (for membership)
                const { data: profile } = await supabase
                    .from("profiles")
                    .select("is_member, membership_tiers(name, discount_percentage)")
                    .eq("id", user.id)
                    .single();

                if (profile) {
                    setCurrentUser({ ...user, is_member: profile.is_member });

                    // Handle potential array/object return
                    const tierData = Array.isArray(profile.membership_tiers)
                        ? profile.membership_tiers[0]
                        : profile.membership_tiers;

                    // Fetch Legacy Discount Setting
                    const { data: discountSetting } = await supabase
                        .from("app_settings")
                        .select("value")
                        .eq("key", "member_discount_percentage")
                        .single();
                    const legacyMemberDiscount = Number(discountSetting?.value ?? 0);

                    // Determine Effective Discount
                    if (tierData) {
                        effectiveDiscount = Number(tierData.discount_percentage);
                        currentTierName = tierData.name;
                    } else if (profile.is_member) {
                        effectiveDiscount = legacyMemberDiscount;
                        currentTierName = "MEMBER";
                    }
                }
            }

            setMemberDiscountPercent(effectiveDiscount);
            setTierName(currentTierName);

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
        // Open from 10 AM to 3 AM (next day)
        // 10 to 24 (midnight) + 1, 2, 3
        // We can represent this as 10 to 27
        for (let i = 10; i < 27; i++) {
            let hour = i;
            if (hour >= 24) hour -= 24;
            slots.push(`${hour}:00`);
        }
        return slots;
    };

    const isSlotAvailable = (timeStr: string) => {
        const [startHours] = timeStr.split(":").map(Number);

        // Handle late night hours (0, 1, 2) being technically "next day" relative to start date
        // But for selection purposes, if we select 1AM, it implies 1AM of the NEXT day if we are viewing "Today" logic?
        // Actually, the UI usually shows a date. If I pick Jan 1, and I see 1:00, does it mean Jan 1 01:00 or Jan 1 Night (Jan 2 01:00)?
        // Conventions usually mean "Operating Day".
        // However, `date` state is set to 00:00:00.
        // If we select "01:00", `new Date(date)` + setHours(1) = Jan 1 01:00.
        // If our operating hours are 10am to 3am, "01:00" on the list likely means "Late Night" (next calendar day).
        // Let's adjust the date parsing logic to handle "Operating Day".

        const slotStart = new Date(date);
        let adjustedHours = startHours;

        // If hour is 0, 1, 2 (and we are in the context of 10am start), treat as next day
        // This is a heuristic: If operating hours are 10am-3am, anything < 10 is "next day"
        if (adjustedHours < 10) {
            slotStart.setDate(slotStart.getDate() + 1);
        }

        slotStart.setHours(adjustedHours, 0, 0, 0);

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

        // Closing time check
        // Operating Hours: 10:00 - 03:00 (next day)
        // If we treat 10:00 as hour 10, and 03:00 as hour 27.
        const checkLimitHour = adjustedHours < 10 ? adjustedHours + 24 : adjustedHours;
        const closingHour = 27; // 3 AM next day

        if (checkLimitHour + duration > closingHour) return false;

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

        // Handle next-day logic for 00:00 - 02:00
        if (hours < 10) {
            startTime.setDate(startTime.getDate() + 1);
        }

        startTime.setHours(hours, 0, 0, 0);
        const endTime = addHours(startTime, duration);

        // Calculate amount (ensure it's a number)
        // @ts-ignore
        // Calculate amount
        let hourlyRate = Number(table.hourly_rate);
        if (memberDiscountPercent > 0) {
            hourlyRate = hourlyRate * ((100 - memberDiscountPercent) / 100);
        }
        const amount = hourlyRate * duration;

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
                            {memberDiscountPercent > 0 && (
                                <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 px-3 py-1">
                                    <span className="text-xs font-bold text-emerald-400 uppercase">{tierName || "MEMBER"}</span>
                                    <span className="text-[10px] text-emerald-300">({memberDiscountPercent}% Off)</span>
                                </div>
                            )}
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
                                        <div className="text-right">
                                            {memberDiscountPercent > 0 && (
                                                <div className="text-xs text-neutral-500 line-through">
                                                    ₱{Number(table.hourly_rate) * duration}
                                                </div>
                                            )}
                                            {/* @ts-ignore */}
                                            <span className="text-2xl font-bold text-white">
                                                ₱{(memberDiscountPercent > 0
                                                    ? (Number(table.hourly_rate) * ((100 - memberDiscountPercent) / 100))
                                                    : Number(table.hourly_rate)) * duration}
                                            </span>
                                        </div>
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
                                                    wallet.balance < ((memberDiscountPercent > 0
                                                        ? (Number(table.hourly_rate) * ((100 - memberDiscountPercent) / 100))
                                                        : Number(table.hourly_rate)) * duration) ? "text-red-400" : "text-emerald-400"
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
                                            {currentUser ? (
                                                <div className="text-neutral-400">
                                                    <p>No wallet found for this account.</p>
                                                    <p className="text-xs mt-1">Please contact support or try reloading.</p>
                                                </div>
                                            ) : (
                                                <Link href="/auth/login" className="text-amber-500 hover:underline">Log in to pay</Link>
                                            )}
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
                                <span className="text-2xl font-bold text-white">
                                    ₱{(memberDiscountPercent > 0
                                        ? (Number(table.hourly_rate) * ((100 - memberDiscountPercent) / 100))
                                        : Number(table.hourly_rate)) * duration}
                                </span>
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
