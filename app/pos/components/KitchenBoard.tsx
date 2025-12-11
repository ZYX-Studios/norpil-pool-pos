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
    status: string; // 'PAID' | 'PREPARING' | 'READY' | 'SERVED'
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
    const supabase = createSupabaseBrowserClient();

    // Fetch initial state
    async function fetchOrders() {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                profiles(full_name),
                table_session:table_sessions(
                    customer_name,
                    pool_table:pool_tables(name)
                ),
                order_items(
                    id,
                    quantity,
                    served_quantity,
                    product:products(name, category)
                )
            `)
            .or("status.in.(PREPARING,READY),and(status.eq.OPEN,order_type.eq.MOBILE)")
            .order("created_at", { ascending: true });

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
                (payload) => {
                    // Start simple: Refresh everything on any order change
                    // Optimization: handle INSERT/UPDATE locally
                    console.log("Realtime event:", payload);
                    fetchOrders();
                }
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
    const newOrders = orders.filter(o => o.status === "OPEN" || (o.status as any) === "NEW" /* handle potential edge cases */);
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
    const elapsed = formatDistanceToNow(new Date(order.created_at), { addSuffix: true });

    return (
        <div className="bg-neutral-800/50 border border-white/5 rounded-xl p-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="font-bold text-lg text-neutral-50">
                        {order.table_label ? (
                            <span className="text-emerald-400">{order.table_label}</span>
                        ) : order.table_session?.pool_table?.name ? (
                            <span className="text-emerald-400">{order.table_session.pool_table.name}</span>
                        ) : (
                            <span className="text-amber-400">Walk-in</span>
                        )}
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
