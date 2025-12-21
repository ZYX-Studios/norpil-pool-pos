"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { markOrderServedAction } from "../actions";

type OrderItem = {
    id: string;
    quantity: number;
    product: {
        name: string;
        category: string;
    };
    served_quantity?: number;
};

type Order = {
    id: string;
    created_at: string;
    sent_at?: string; // New field for actual submission time
    status: string; // 'PAID' | 'PREPARING' | 'READY' | 'SERVED' | 'SUBMITTED'
    order_type: string;
    table_label?: string;
    profiles?: {
        full_name: string;
    };
    table_session?: {
        customer_name?: string;
        pool_table?: {
            name: string;
        };
    };
    order_items: OrderItem[];
};

export function KitchenBoard() {
    const [orders, setOrders] = useState<Order[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [supabase] = useState(() => createSupabaseBrowserClient());

    // Fetch initial state
    async function fetchOrders() {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                profiles(full_name),
                table_session:table_sessions(
                    customer_name,
                    pool_table:pool_tables!table_sessions_pool_table_id_fkey(name)
                ),
                order_items(
                    id,
                    quantity,
                    served_quantity,
                    product:products(name, category)
                )
            `)
            .or("status.in.(SUBMITTED,PREPARING,READY,PAID),and(status.eq.OPEN,order_type.eq.MOBILE)")
            .order("sent_at", { ascending: true, nullsFirst: false })
            .order("created_at", { ascending: true }); // Fallback for old orders

        if (!error && data) {
            // Client-side filtering because Supabase deep filtering on joined tables is tricky/limited
            const filteredData = data.map((order: any) => ({
                ...order,
                order_items: (order.order_items || [])
                    .filter((item: any) => item.product?.category !== 'TABLE_TIME')
                    .map((item: any) => ({
                        ...item,
                        // Calculate display quantity: Total - Served
                        quantity: (item.quantity || 0) - (item.served_quantity || 0)
                    }))
                    .filter((item: any) => item.quantity > 0) // Hide fully served items
            })).filter((order: any) => order.order_items.length > 0); // Remove empty orders

            setOrders(filteredData);
        } else if (error) {
            console.error("Error fetching kitchen orders:", error);
        }
    }

    // Subscribe to updates
    useEffect(() => {
        fetchOrders();

        const channel = supabase
            .channel("kitchen-orders")
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                },
                () => fetchOrders()
            )
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "order_items",
                },
                () => fetchOrders()
            )
            .subscribe((status) => {
                setIsConnected(status === "SUBSCRIBED");
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, [supabase]);

    async function updateStatus(orderId: string, newStatus: string) {
        // Optimistic update
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));

        if (newStatus === "SERVED") {
            try {
                await markOrderServedAction(orderId);
            } catch (err) {
                console.error("Failed to mark served", err);
                fetchOrders(); // Revert
            }
        } else {
            const { error } = await supabase
                .from("orders")
                .update({ status: newStatus })
                .eq("id", orderId);

            if (error) {
                console.error("Failed to update status", error);
                fetchOrders(); // Revert
            }
        }
    }

    // Grouping
    // We intentionally exclude PAID/SERVED from "New" to avoid resurfacing old orders.
    // If a "Pay First" workflow is needed later, we need a separate logic (e.g. check if items were prepped).
    const newOrders = orders.filter(o => o.status === "SUBMITTED" || o.status === "OPEN" || o.status === "PAID" || (o.status as any) === "NEW");
    const prepOrders = orders.filter(o => o.status === "PREPARING");
    const readyOrders = orders.filter(o => o.status === "READY");

    return (
        <div className="h-full flex flex-col">
            <header className="mb-6 flex items-center justify-between">
                <h1 className="text-2xl font-bold text-neutral-50">Kitchen Display</h1>
                <div className={cn("px-3 py-1 rounded-full text-xs font-medium", isConnected ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400")}>
                    {isConnected ? "Live Connected" : "Connecting..."}
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full overflow-hidden">
                <Column
                    title="New Orders"
                    count={newOrders.length}
                    orders={newOrders}
                    color="emerald"
                    onNext={(id) => updateStatus(id, "PREPARING")}
                    btnLabel="Start Prep"
                />
                <Column
                    title="Preparing"
                    count={prepOrders.length}
                    orders={prepOrders}
                    color="amber"
                    onNext={(id) => updateStatus(id, "READY")}
                    btnLabel="Mark Ready"
                />
                <Column
                    title="Ready for Pickup"
                    count={readyOrders.length}
                    orders={readyOrders}
                    color="blue"
                    onNext={(id) => updateStatus(id, "SERVED")}
                    btnLabel="Complete"
                />
            </div>
        </div>
    );
}

function Column({
    title,
    count,
    orders,
    color,
    onNext,
    btnLabel
}: {
    title: string;
    count: number;
    orders: Order[];
    color: "emerald" | "amber" | "blue";
    onNext: (id: string) => void;
    btnLabel: string;
}) {
    const colorStyles = {
        emerald: "border-emerald-500/20 bg-emerald-500/5 text-emerald-400",
        amber: "border-amber-500/20 bg-amber-500/5 text-amber-400",
        blue: "border-blue-500/20 bg-blue-500/5 text-blue-400",
    };

    return (
        <div className={cn("flex flex-col rounded-2xl border h-full overflow-hidden", colorStyles[color].split(" ")[0], "bg-neutral-900/50")}>
            <div className={cn("p-4 border-b", colorStyles[color])}>
                <div className="flex items-center justify-between">
                    <h2 className="font-bold text-lg">{title}</h2>
                    <span className="bg-neutral-950/30 px-2 py-0.5 rounded text-sm">{count}</span>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {orders.map(order => (
                    <OrderCard key={order.id} order={order} onAction={() => onNext(order.id)} actionLabel={btnLabel} />
                ))}
            </div>
        </div>
    );
}

function OrderCard({ order, onAction, actionLabel }: { order: Order; onAction: () => void; actionLabel: string }) {
    // Force re-render of timer every minute? 
    // Usually handled by a separate Timer component or interval in parent, but for simple MVP:
    // Prefer sent_at, fallback to created_at
    const startTime = order.sent_at ? new Date(order.sent_at) : new Date(order.created_at);
    // Use formatDistanceToNow but ensure we handle invalid dates gracefully if needed
    const elapsed = formatDistanceToNow(startTime, { addSuffix: true });

    // Determine Card Style
    const isAdvance = order.table_label?.startsWith("Advance");
    const isWalkIn = order.table_label === "Walk-in";

    let borderColor = "border-white/5";
    let shadowColor = "";
    let headerBg = "bg-white/5 border-white/5";
    let titleColor = "text-white";

    if (isAdvance) {
        borderColor = "border-purple-500/50";
        shadowColor = "shadow-purple-500/10";
        headerBg = "bg-purple-500/20 border-purple-500/20";
        titleColor = "text-purple-300";
    } else if (isWalkIn) {
        borderColor = "border-amber-500/50";
        shadowColor = "shadow-amber-500/10";
        headerBg = "bg-amber-500/20 border-amber-500/20";
        titleColor = "text-amber-300";
    }

    return (
        <div
            key={order.id}
            className={cn(
                "bg-neutral-800 rounded-xl overflow-hidden border shadow-lg flex flex-col animate-in fade-in slide-in-from-bottom-2",
                borderColor, shadowColor
            )}
        >
            {/* Header */}
            <div className={cn("p-3 flex justify-between items-start border-b", headerBg)}>
                <div>
                    <div className="flex items-center space-x-2">
                        <h3 className={cn("font-bold text-lg", titleColor)}>
                            {order.table_session?.pool_table?.name || order.table_label || "No Table"}
                        </h3>
                        {/* Badge */}
                        <div className="text-xs font-mono text-neutral-500 bg-neutral-950 px-2 py-1 rounded">
                            {elapsed}
                        </div>
                    </div>
                    <div className="text-xs text-neutral-400">
                        {order.table_session?.customer_name || order.profiles?.full_name || "Guest"}
                    </div>
                </div>
                <div className="text-xs font-mono text-neutral-500 bg-neutral-950 px-2 py-1 rounded">
                    {elapsed}
                </div>
            </div>

            <div className="space-y-2 mb-4">
                {order.order_items.map(item => (
                    <div key={item.id} className="flex justify-between text-sm">
                        <span className="text-neutral-300">
                            <span className="font-bold text-neutral-50 mr-2">{item.quantity}x</span>
                            {item.product?.name}
                        </span>
                    </div>
                ))}
                {(!order.order_items || order.order_items.length === 0) && (
                    <div className="text-xs text-red-400 italic">No items (Syncing?)</div>
                )}
            </div>

            <button
                onClick={onAction}
                className="w-full bg-white/5 hover:bg-white/10 text-neutral-200 text-sm font-semibold py-2 rounded-lg transition-colors border border-white/10"
            >
                {actionLabel}
            </button>
        </div>
    );
}
