import Link from "next/link";
import { Logo } from "@/app/components/ui/Logo";
import { GlassCard } from "../components/GlassCard";
import { UtensilsCrossed, CalendarClock, Wallet, ArrowRight, User } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function HomePage() {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    // Fetch wallet balance if user is logged in
    let walletBalance = 0;
    if (user) {
        const { data: wallet } = await supabase
            .from("wallets")
            .select("balance")
            .eq("profile_id", user.id)
            .single();

        walletBalance = wallet?.balance ?? 0;
    }

    return (
        <div className="p-6 space-y-6 max-w-md mx-auto pt-8">
            {/* Header Section */}
            <header className="flex items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <Logo className="h-14 w-14 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.15)]" />
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-neutral-400 font-medium text-[10px] tracking-[0.15em] uppercase">Welcome to</p>
                        <h1 className="text-2xl font-bold tracking-tight text-white leading-none">
                            Norpil Billiards
                        </h1>
                    </div>
                </div>
                <Link href="/mobile/profile">
                    <div className="w-11 h-11 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shadow-lg shadow-black/20 hover:bg-white/10 transition-colors">
                        <User className="size-5 text-neutral-300" />
                    </div>
                </Link>
            </header>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-3">
                <Link href="/mobile/reservations" className="block group">
                    <div className="relative h-full aspect-[4/5] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 flex flex-col justify-between overflow-hidden backdrop-blur-sm transition-all duration-300 group-active:scale-[0.97] hover:border-white/20 shadow-lg shadow-black/20">
                        {/* Subtle background pattern */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-50"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                                <CalendarClock className="size-5 text-white" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight mb-1.5">Reserve<br />Table</h3>
                                <p className="text-xs text-neutral-400 font-medium">Book your spot</p>
                            </div>
                        </div>
                    </div>
                </Link>

                <Link href="/mobile/order" className="block group">
                    <div className="relative h-full aspect-[4/5] rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 flex flex-col justify-between overflow-hidden backdrop-blur-sm transition-all duration-300 group-active:scale-[0.97] hover:border-white/20 shadow-lg shadow-black/20">
                        {/* Subtle background pattern */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent opacity-50"></div>

                        <div className="relative z-10 flex flex-col h-full justify-between">
                            <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
                                <UtensilsCrossed className="size-5 text-white" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white leading-tight mb-1.5">Order<br />Food</h3>
                                <p className="text-xs text-neutral-400 font-medium">Snacks & Drinks</p>
                            </div>
                        </div>
                    </div>
                </Link>
            </div>

            {/* Wallet Section - Premium Card */}
            <Link href="/mobile/wallet" className="block group">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 p-6 shadow-2xl shadow-black/40 group-active:scale-[0.98] transition-all duration-300">
                    {/* Refined texture */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] bg-repeat bg-[length:100px_100px]"></div>

                    {/* Subtle glow */}
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/[0.03] rounded-full blur-3xl"></div>

                    <div className="relative z-10 flex flex-col gap-5">
                        <div className="flex justify-between items-start">
                            <div className="p-2.5 rounded-xl bg-white/5 border border-white/10">
                                <Wallet className="size-5 text-white" />
                            </div>
                            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-neutral-400 bg-black/20 px-2.5 py-1.5 rounded-full border border-white/5 tracking-wider">
                                <span>VIEW WALLET</span>
                                <ArrowRight className="size-3" />
                            </div>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-neutral-500 mb-2 tracking-wider uppercase">Balance</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl font-bold text-white tracking-tight">
                                    ₱ {walletBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]"></div>
                            <p className="text-xs text-emerald-400 font-semibold">Active</p>
                        </div>
                    </div>
                </div>
            </Link>

            {/* Info Section - Refined */}
            <div className="flex items-start gap-3 p-4 rounded-xl border border-white/10 bg-white/[0.02]">
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="text-lg">🎱</span>
                </div>
                <div className="flex-1 pt-0.5">
                    <h4 className="font-bold text-white text-sm mb-1">Quick Tip</h4>
                    <p className="text-xs text-neutral-400 leading-relaxed">Order from your table to keep the game flowing smoothly.</p>
                </div>
            </div>
        </div>
    );
}
