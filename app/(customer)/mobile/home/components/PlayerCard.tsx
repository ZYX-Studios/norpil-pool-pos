import { Logo } from "@/app/components/ui/Logo";
import { User } from "lucide-react";

interface PlayerCardProps {
    profile: {
        full_name: string | null;
        ranking: number | null;
        created_at: string;
    } | null;
    walletBalance: number;
}

export function PlayerCard({ profile, walletBalance }: PlayerCardProps) {
    const rank = Number(profile?.ranking || 0).toFixed(1);
    const name = profile?.full_name || "Guest";
    const firstName = name.split(' ')[0];

    return (
        <div className="relative w-full">
            {/* Main Card Container */}
            <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-white/10 shadow-2xl">
                {/* Subtle grain texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay"></div>

                {/* Top accent line */}
                <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent"></div>

                {/* Content */}
                <div className="relative z-10 p-8 space-y-6">

                    {/* Header: Logo and Badge */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <Logo className="h-7 w-7 text-white/90" />
                            <div className="h-4 w-[1px] bg-white/10"></div>
                            <span className="text-[9px] font-bold tracking-[0.2em] text-white/50 uppercase">Norpil Billiards</span>
                        </div>
                        <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                            <span className="text-[8px] font-bold text-emerald-400 tracking-widest uppercase">Member</span>
                        </div>
                    </div>

                    {/* Main Content: Rank Display */}
                    <div className="flex items-end justify-between pt-2">
                        {/* Left: Player Info */}
                        <div className="space-y-2 flex-1">
                            <div>
                                <p className="text-[10px] font-semibold text-white/40 tracking-wider uppercase mb-1">Player</p>
                                <h2 className="text-2xl font-bold text-white tracking-tight leading-none">
                                    {firstName}
                                </h2>
                            </div>
                        </div>

                        {/* Right: Rank Badge */}
                        <div className="flex flex-col items-end">
                            <div className="relative">
                                {/* Rank container with glow */}
                                <div className="relative rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-400/30 px-5 py-3 backdrop-blur-sm">
                                    <div className="absolute inset-0 bg-emerald-400/5 rounded-2xl blur-xl"></div>
                                    <div className="relative text-center">
                                        <p className="text-[9px] font-bold text-emerald-400/70 tracking-[0.15em] uppercase mb-0.5">Rating</p>
                                        <p className="text-4xl font-black text-white leading-none tracking-tight">
                                            {rank}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Stats Bar */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-4">
                            <div>
                                <p className="text-[9px] font-semibold text-white/40 tracking-wider uppercase mb-0.5">Wallet</p>
                                <p className="text-sm font-bold text-white/90 font-mono">₱{walletBalance.toLocaleString()}</p>
                            </div>
                            <div className="h-6 w-[1px] bg-white/10"></div>
                            <div>
                                <p className="text-[9px] font-semibold text-white/40 tracking-wider uppercase mb-0.5">Since</p>
                                <p className="text-sm font-bold text-white/90 font-mono">{new Date(profile?.created_at || new Date()).getFullYear()}</p>
                            </div>
                        </div>

                        {/* Status indicator */}
                        <div className="flex items-center gap-1.5">
                            <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"></div>
                            <span className="text-[9px] font-bold text-emerald-400/90 tracking-wider uppercase">Active</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
