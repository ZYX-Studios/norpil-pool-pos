import Link from "next/link";
import { GlassCard } from "../components/GlassCard";
import { UtensilsCrossed, CalendarClock, Wallet, ArrowRight, User } from "lucide-react";

export default function HomePage() {
    return (
        <div className="p-6 space-y-8 max-w-md mx-auto pt-10">
            {/* Header Section */}
            <header className="flex items-center justify-between pb-2">
                <div className="space-y-1">
                    <p className="text-emerald-400 font-medium text-sm tracking-uppercase uppercase tracking-wider">Welcome back</p>
                    <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">
                        Norpil Billiards
                    </h1>
                </div>
                <div className="w-12 h-12 rounded-full bg-neutral-800 border border-neutral-700 flex items-center justify-center shadow-lg shadow-black/40">
                    <User className="size-6 text-neutral-400" />
                </div>
            </header>

            {/* Quick Actions Grid */}
            <div className="grid grid-cols-2 gap-4">
                <Link href="/mobile/reservations" className="block group">
                    <GlassCard className="h-full aspect-[4/5] flex flex-col justify-between p-5 relative overflow-hidden transition-transform duration-300 group-active:scale-[0.98]">
                        <div className="absolute top-0 right-0 p-3 opacity-50">
                            <CalendarClock className="size-16 text-indigo-400/20 -rotate-12 transform translate-x-4 -translate-y-4" />
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 shadow-lg shadow-indigo-900/20 mb-4">
                            <CalendarClock className="size-6 text-indigo-300" />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-white leading-tight mb-1">Reserve<br />Table</h3>
                            <p className="text-xs text-indigo-200/60 font-medium">Book your spot</p>
                        </div>
                    </GlassCard>
                </Link>

                <Link href="/mobile/order" className="block group">
                    <GlassCard className="h-full aspect-[4/5] flex flex-col justify-between p-5 relative overflow-hidden transition-transform duration-300 group-active:scale-[0.98]">
                        <div className="absolute top-0 right-0 p-3 opacity-50">
                            <UtensilsCrossed className="size-16 text-emerald-400/20 -rotate-12 transform translate-x-4 -translate-y-4" />
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30 shadow-lg shadow-emerald-900/20 mb-4">
                            <UtensilsCrossed className="size-6 text-emerald-300" />
                        </div>

                        <div>
                            <h3 className="text-lg font-semibold text-white leading-tight mb-1">Order<br />Food</h3>
                            <p className="text-xs text-emerald-200/60 font-medium">Snacks & Drinks</p>
                        </div>
                    </GlassCard>
                </Link>
            </div>

            {/* Wallet Section - Credit Card Style */}
            <Link href="/mobile/wallet" className="block group">
                <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-neutral-800 to-neutral-900 p-6 shadow-xl shadow-black/30 group-active:scale-[0.98] transition-all duration-300">
                    {/* Card Pattern/Shine */}
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 bg-repeat bg-[length:100px_100px]"></div>
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/5 rounded-full blur-3xl"></div>

                    <div className="relative z-10 flex flex-col gap-6">
                        <div className="flex justify-between items-start">
                            <div className="p-2 rounded-lg bg-white/5 border border-white/5 backdrop-blur-md">
                                <Wallet className="size-6 text-amber-100" />
                            </div>
                            <div className="flex items-center gap-1 text-xs font-medium text-neutral-400 bg-black/20 px-2 py-1 rounded-full border border-white/5">
                                <span>TAP TO VIEW</span>
                                <ArrowRight className="size-3" />
                            </div>
                        </div>

                        <div>
                            <p className="text-sm font-medium text-neutral-400 mb-1">Available Balance</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-3xl font-bold text-white tracking-tight">₱ --.--</span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <p className="text-xs text-emerald-400 font-medium">Ready to pay</p>
                        </div>
                    </div>
                </div>
            </Link>

            {/* Promo / Info Section */}
            <GlassCard className="flex items-center gap-4 p-4 !bg-blue-500/10 !border-blue-500/20">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <span className="text-xl">🎱</span>
                </div>
                <div className="flex-1">
                    <h4 className="font-semibold text-blue-100 text-sm">Pro Tip</h4>
                    <p className="text-xs text-blue-200/70">Order straight from the table to keep the game going.</p>
                </div>
            </GlassCard>
        </div>
    );
}
