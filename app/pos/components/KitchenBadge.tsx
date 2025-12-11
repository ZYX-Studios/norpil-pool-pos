"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function KitchenBadge({ onClick }: { onClick: () => void }) {
    const [count, setCount] = useState(0);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        // Initial fetch
        const fetchCount = async () => {
            // Match KDS Filter Logic: PREPARING, READY, PAID, or (OPEN + MOBILE)
            const { count } = await supabase
                .from("orders")
                .select("*", { count: "exact", head: true })
                .or("status.in.(PREPARING,READY,PAID),and(status.eq.OPEN,order_type.eq.MOBILE)");

            setCount(count || 0);
        };

        fetchCount();

        // Subscribe to changes
        const channel = supabase
            .channel("kitchen-badge-updates")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                () => fetchCount()
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "order_items",
                },
                () => fetchCount()
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    return (
        <button
            onClick={onClick}
            className="group relative flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-neutral-700 active:scale-95"
        >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-neutral-400 group-hover:text-emerald-400 transition-colors">
                <path fillRule="evenodd" d="M3 5.25a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75H3.75A.75.75 0 013 8.25v-3zm0 6.75a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75v-3zm0 6.75a.75.75 0 01.75-.75h16.5a.75.75 0 01.75.75v3a.75.75 0 01-.75.75H3.75a.75.75 0 01-.75-.75v-3z" clipRule="evenodd" />
            </svg>
            <span>Kitchen</span>
            {count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white shadow-sm ring-2 ring-neutral-900 animate-bounce">
                    {count}
                </span>
            )}
        </button>
    );
}
