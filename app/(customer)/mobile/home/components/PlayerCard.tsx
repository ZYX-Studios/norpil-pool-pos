import { Logo } from "@/app/components/ui/Logo";
import Image from "next/image";

interface PlayerCardProps {
    profile: {
        full_name: string | null;
        ranking: number | null;
        created_at: string;
        avatar_url: string | null;
        membership_number?: string | null;
        is_member?: boolean;
    } | null;
    walletBalance: number;
}

export function PlayerCard({ profile, walletBalance }: PlayerCardProps) {
    const rank = Number(profile?.ranking || 0).toFixed(1);
    const name = profile?.full_name || "Guest";
    const firstName = name.split(' ')[0];

    return (
        <div className="relative w-full">
            {/* Dark Premium Card */}
            <div className="relative rounded-3xl overflow-hidden shadow-2xl">

                {/* Dark Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-neutral-950 via-neutral-900 to-black"></div>

                {/* Subtle Rank Outline - Soft Background Watermark */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
                    <div
                        className="text-[280px] font-black leading-none tracking-tighter"
                        style={{
                            WebkitTextStroke: '2px rgba(255,255,255,0.03)',
                            color: 'transparent',
                            textShadow: '0 0 60px rgba(255,255,255,0.02)'
                        }}
                    >
                        {rank}
                    </div>
                </div>

                {/* Subtle grain texture */}
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-overlay"></div>

                {/* Top accent line - subtle */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>

                {/* Content Container */}
                <div className="relative z-10 p-6">

                    {/* Header */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-2">
                            <Logo className="h-5 w-5 text-white/70" />
                            <span className="text-[9px] font-bold tracking-[0.25em] text-white/50 uppercase">Norpil Billiards</span>
                        </div>
                        {profile?.membership_number ? (
                            <div className="px-3 py-1.5 rounded-md bg-white/5 border border-white/10">
                                <span className="text-[10px] font-mono font-bold text-white/80 tracking-[0.15em]">{profile.membership_number}</span>
                            </div>
                        ) : (
                            <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10">
                                <span className="text-[8px] font-bold text-white/60 tracking-widest uppercase">{profile?.is_member ? 'Member' : 'Guest'}</span>
                            </div>
                        )}
                    </div>

                    {/* Main Player Section */}
                    <div className="flex flex-col items-center">

                        {/* Avatar with subtle glow */}
                        <div className="relative mb-6">
                            {/* Subtle glow */}
                            <div className="absolute -inset-4 bg-white/5 rounded-full blur-2xl"></div>

                            {/* Avatar */}
                            <div className="relative w-36 h-36 rounded-full overflow-hidden border-2 border-white/10 shadow-2xl">
                                {profile?.avatar_url ? (
                                    <Image
                                        src={profile.avatar_url}
                                        alt={firstName}
                                        fill
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-5xl font-black text-white/80 bg-gradient-to-br from-neutral-800 to-neutral-900">
                                        {firstName[0]?.toUpperCase() || 'U'}
                                    </div>
                                )}
                            </div>

                            {/* Rank Badge - Minimal and Elegant */}
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2">
                                <div className="relative">
                                    {/* Subtle glow */}
                                    <div className="absolute -inset-1 bg-white/10 rounded-xl blur-md"></div>

                                    {/* Badge */}
                                    <div className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-xl px-5 py-2 border border-white/20 backdrop-blur-md shadow-xl">
                                        <p className="text-3xl font-black text-white leading-none tracking-tight">
                                            {rank}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Player Name - Clean Typography */}
                        <div className="text-center mb-6 mt-4">
                            <h2 className="text-4xl font-black text-white leading-none tracking-tight mb-2">
                                {firstName.toUpperCase()}
                            </h2>
                            <div className="flex items-center justify-center gap-2">
                                <div className="h-px w-6 bg-gradient-to-r from-transparent to-white/20"></div>
                                <p className="text-[10px] font-semibold text-white/40 tracking-[0.25em] uppercase">Player</p>
                                <div className="h-px w-6 bg-gradient-to-l from-transparent to-white/20"></div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Bar - Minimal */}
                    <div className="relative mt-4">
                        <div className="absolute inset-0 bg-white/5 rounded-xl"></div>

                        <div className="relative grid grid-cols-2 gap-px p-4 rounded-xl border border-white/10">
                            {/* Wallet */}
                            <div className="text-center">
                                <p className="text-[9px] font-semibold text-white/40 tracking-wider uppercase mb-1">Wallet</p>
                                <p className="text-base font-bold text-white/90 font-mono">₱{walletBalance.toLocaleString()}</p>
                            </div>

                            {/* Member Since */}
                            <div className="text-center">
                                <p className="text-[9px] font-semibold text-white/40 tracking-wider uppercase mb-1">Since</p>
                                <p className="text-base font-bold text-white/90 font-mono">{new Date(profile?.created_at || new Date()).getFullYear()}</p>
                            </div>
                        </div>
                    </div>

                    {/* Active Status */}
                    <div className="flex items-center justify-center mt-4">
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                            <div className="relative">
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.4)] animate-pulse"></div>
                                <div className="absolute inset-0 h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping"></div>
                            </div>
                            <span className="text-[9px] font-semibold text-white/60 tracking-wider uppercase">Active</span>
                        </div>
                    </div>
                </div>

                {/* Bottom accent line */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
            </div>
        </div>
    );
}
