"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Wallet, Calendar, Utensils, User } from "lucide-react";
import { cn } from "@/lib/utils";

export function BottomNav() {
    const pathname = usePathname();

    const navItems = [
        { href: "/mobile/home", label: "Home", icon: Home },
        { href: "/mobile/wallet", label: "Wallet", icon: Wallet },
        { href: "/mobile/reserve", label: "Reserve", icon: Calendar },
        { href: "/mobile/order", label: "Order", icon: Utensils },
        { href: "/mobile/profile", label: "Profile", icon: User },
    ];

    return (
        <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-neutral-900/80 backdrop-blur-lg pb-safe z-50">
            <div className="flex justify-around items-center h-16">
                {navItems.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href);
                    return (
                        <Link
                            key={href}
                            href={href}
                            className={cn(
                                "flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors",
                                isActive ? "text-emerald-400" : "text-neutral-400 hover:text-neutral-200"
                            )}
                        >
                            <Icon size={24} strokeWidth={isActive ? 2.5 : 2} />
                            <span className="text-[10px] font-medium">{label}</span>
                        </Link>
                    );
                })}
            </div>
        </nav>
    );
}
