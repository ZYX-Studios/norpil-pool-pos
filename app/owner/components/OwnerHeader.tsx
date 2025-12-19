"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/app/components/ui/Logo";
import { logoutAction } from "@/app/auth/actions";
import { LayoutDashboard, CreditCard, LogOut, ShieldCheck } from "lucide-react";

interface OwnerHeaderProps {
    staff: {
        name: string;
        role: string;
        email?: string;
    } | null;
}

export function OwnerHeader({ staff }: OwnerHeaderProps) {
    const pathname = usePathname();

    const links = [
        { href: "/owner", label: "Dashboard", icon: LayoutDashboard },
        { href: "/admin", label: "Admin Portal", icon: ShieldCheck },
    ];

    return (
        <header className="mb-8 flex flex-col gap-6 rounded-3xl border border-white/5 bg-neutral-900/80 px-8 py-6 shadow-2xl backdrop-blur-xl">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                {/* Brand */}
                <div className="flex items-center gap-4">
                    <Logo className="h-16 w-16 text-emerald-400" />
                    <div>
                        <div className="text-xs font-bold uppercase tracking-widest text-emerald-400/80">Norpil Billiards</div>
                        <div className="text-xl font-bold text-white tracking-tight">Owner Dashboard</div>
                    </div>
                </div>

                {/* User & Actions */}
                <div className="flex items-center gap-4 bg-white/5 rounded-full p-1.5 pr-6 border border-white/5">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-emerald-600 to-emerald-500 flex items-center justify-center border border-white/10 shadow-lg shadow-emerald-900/20">
                        <span className="text-xs font-bold text-white">
                            {staff?.name?.charAt(0) || "O"}
                        </span>
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-white leading-none">{staff?.name}</span>
                        <span className="text-[10px] uppercase tracking-wider text-emerald-400/80 font-medium mt-0.5">{staff?.role}</span>
                    </div>
                    <div className="h-8 w-px bg-white/10 mx-2" />
                    <div className="flex items-center gap-2">
                        <Link
                            href="/pos"
                            className="flex items-center gap-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 hover:text-emerald-300 transition-all"
                        >
                            <CreditCard className="w-3.5 h-3.5" />
                            POS
                        </Link>
                        <form action={logoutAction}>
                            <button
                                type="submit"
                                className="flex items-center gap-2 rounded-full hover:bg-red-500/10 border border-transparent hover:border-red-500/20 px-3 py-1.5 text-xs font-bold text-neutral-400 hover:text-red-400 transition-all"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                Sign Out
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1 overflow-x-auto pb-2 md:pb-0 scrollbar-hide [&::-webkit-scrollbar]:hidden -mx-2 px-2">
                {links.map((link) => {
                    const Icon = link.icon;
                    const isActive = pathname === link.href;
                    return (
                        <Link
                            key={link.href}
                            href={link.href}
                            className={cn(
                                "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all duration-200 whitespace-nowrap",
                                isActive
                                    ? "bg-white text-black shadow-lg shadow-white/10 scale-105"
                                    : "text-neutral-400 hover:text-white hover:bg-white/5"
                            )}
                        >
                            <Icon className={cn("w-4 h-4", isActive ? "text-neutral-900" : "text-neutral-500 group-hover:text-white")} />
                            {link.label}
                        </Link>
                    );
                })}
            </nav>
        </header>
    );
}
