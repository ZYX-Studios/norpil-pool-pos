"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function KitchenBadge({ onClick }: { onClick: () => void }) {
    const [count, setCount] = useState(0);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        const fetchCount = async () => {
            // Fetch the LATEST 50 orders that are relevant to the kitchen.
            // Sorting by descending creation date ensures we see the new active orders
            // instead of getting stuck scanning the oldest 1000 records.
            const { data } = await supabase
                .from("orders")
                .select(`
                    id,
                    status,
                    order_type,
                    order_items (
                        id,
                        quantity,
                        served_quantity,
                        product:products(name, category)
                    )
                `)
                .or("status.in.(SUBMITTED,PREPARING,READY,PAID),and(status.eq.OPEN,order_type.eq.MOBILE)")
                .order("created_at", { ascending: false })
                .limit(50);

            if (!data) {
                setCount(0);
                return;
            }

            // Client-side filtering to calculate actual pending items
            const activeOrders = data.map((order: any) => ({
                ...order,
                order_items: (order.order_items || [])
                    .filter((item: any) => {
                        const cat = Array.isArray(item.product) ? item.product[0]?.category : item.product?.category;
                        return cat !== 'TABLE_TIME';
                    })
                    .map((item: any) => ({
                        ...item,
                        // Calculate display quantity: Total - Served
                        quantity: (Number(item.quantity) || 0) - (Number(item.served_quantity) || 0)
                    }))
                    .filter((item: any) => item.quantity > 0) // Hide fully served items
            })).filter((order: any) => order.order_items.length > 0);

            setCount(activeOrders.length);
        };

        fetchCount();

        const channel = supabase
            .channel("kitchen-badge-updates")
            .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchCount())
            .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => fetchCount())
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
