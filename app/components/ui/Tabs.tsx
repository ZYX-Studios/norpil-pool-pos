"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

interface Tab {
    id: string;
    label: string;
}

interface TabsProps {
    tabs: Tab[];
    currentView: string;
    baseUrl: string;
    paramName?: string;
}

export function Tabs({ tabs, currentView, baseUrl, paramName = "view" }: TabsProps) {
    const searchParams = useSearchParams();

    return (
        <nav className="flex flex-wrap gap-2 text-xs">
            {tabs.map((tab) => {
                // Preserve other search params
                const newParams = new URLSearchParams(searchParams.toString());
                newParams.set(paramName, tab.id);
                const href = `${baseUrl}?${newParams.toString()}`;
                const isActive = currentView === tab.id;

                return (
                    <Link
                        key={tab.id}
                        href={href}
                        className={cn(
                            "rounded-full border px-3 py-1 transition-colors",
                            isActive
                                ? "border-white/60 bg-white text-neutral-900"
                                : "border-white/10 bg-white/5 text-neutral-300 hover:border-white/30 hover:text-white",
                        )}
                    >
                        {tab.label}
                    </Link>
                );
            })}
        </nav>
    );
}
