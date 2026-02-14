"use client";

import { useState, useEffect } from "react";
import { ProductList } from "./components/ProductList";
import { CartSheet } from "./components/CartSheet";

import { useSearchParams, useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Product = {
    id: string;
    name: string;
    price: number;
    category: string;
    stock: number;
};

export default function OrderPageClient({ products: initialProducts }: { products: Product[] }) {
    const searchParams = useSearchParams();
    const router = useRouter();
    const tableIdentifier = searchParams.get("table") || undefined;
    const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

    // Filter out TABLE_TIME products
    const products = initialProducts.filter(p => p.category !== "TABLE_TIME");

    // Table Selection State
    const [selectedTable, setSelectedTable] = useState<string | undefined>(tableIdentifier);
    const [availableTables, setAvailableTables] = useState<{ id: string, name: string }[]>([]);

    // Mode State: DINE_IN vs ADVANCE
    const [mode, setMode] = useState<"DINE_IN" | "ADVANCE" | "WALK_IN">("DINE_IN");
    const [advanceTime, setAdvanceTime] = useState<string>("15 mins");

    // Fetch Tables if needed
    useEffect(() => {
        if (!tableIdentifier) {
            const supabase = createSupabaseBrowserClient();
            supabase.from("pool_tables")
                .select("id, name, deleted_at") // Select deleted_at to filter
                .is("deleted_at", null) // Filter out deleted tables
                .order("name")
                .then(({ data }) => {
                    if (data) setAvailableTables(data);
                });
        } else {
            setTimeout(() => setSelectedTable(tableIdentifier), 0);
        }
    }, [tableIdentifier]);

    // Handle initial selection
    

    // Computed table identifier for cart
    let finalTableIdentifier: string | undefined = selectedTable;
    if (mode === "ADVANCE") {
        finalTableIdentifier = `ADVANCE::Arriving in ${advanceTime}`;
    } else if (mode === "WALK_IN") {
        finalTableIdentifier = "WALK_IN";
    }

    function addToCart(product: Product) {
        if (product.stock <= 0) {
            return;
        }
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) return prev;
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    }

    function removeFromCart(productId: string) {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    }

    function clearCart() {
        setCart([]);
    }

    const timeOptions = ["15 mins", "30 mins", "45 mins", "1 hour"];

    return (
        <div className="p-6 pb-32 space-y-6 max-w-md mx-auto pt-8 min-h-screen">
            <header className="space-y-4">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-white">Order Food & Drinks</h1>
                        <p className="text-neutral-400 text-sm mt-1">Select items to add to your order.</p>
                    </div>
                </div>

                {/* Mode Toggle - Only show if no table pre-selected */}
                {!tableIdentifier && (
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-1 grid grid-cols-3 gap-1">
                        <button
                            onClick={() => setMode("DINE_IN")}
                            className={cn(
                                "py-2 text-xs font-semibold rounded-xl transition-all",
                                mode === "DINE_IN"
                                    ? "bg-white text-black shadow-lg shadow-white/10"
                                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                            )}
                        >
                            At Table
                        </button>
                        <button
                            onClick={() => setMode("WALK_IN")}
                            className={cn(
                                "py-2 text-xs font-semibold rounded-xl transition-all",
                                mode === "WALK_IN"
                                    ? "bg-white text-black shadow-lg shadow-white/10"
                                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                            )}
                        >
                            Walk-in
                        </button>
                        <button
                            onClick={() => setMode("ADVANCE")}
                            className={cn(
                                "py-2 text-xs font-semibold rounded-xl transition-all",
                                mode === "ADVANCE"
                                    ? "bg-white text-black shadow-lg shadow-white/10"
                                    : "text-neutral-400 hover:text-neutral-200 hover:bg-white/5"
                            )}
                        >
                            Advance
                        </button>
                    </div>
                )}
            </header>

            {/* Selection Area */}
            {!tableIdentifier && (
                <div className="animate-in fade-in slide-in-from-top-4 duration-300">
                    {mode === "DINE_IN" && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">Select Your Table</h3>
                            <div className="grid grid-cols-3 gap-3">
                                {availableTables.map(t => {
                                    const tName = t.name.replace('Table ', '');
                                    const isSelected = selectedTable === tName || selectedTable === t.name;
                                    return (
                                        <button
                                            key={t.id}
                                            onClick={() => setSelectedTable(tName)}
                                            className={cn(
                                                "aspect-square rounded-xl border flex flex-col items-center justify-center p-2 transition-all active:scale-95",
                                                isSelected
                                                    ? "bg-white/10 border-white/30 text-white shadow-lg shadow-white/10"
                                                    : "bg-neutral-900 border-white/5 text-neutral-400 hover:bg-white/5 hover:border-white/10"
                                            )}
                                        >
                                            <span className="text-2xl font-bold">{tName}</span>
                                            <span className="text-[10px] uppercase opacity-70">Table</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {mode === "WALK_IN" && (
                        <div className="space-y-3">
                            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 flex items-start gap-3">
                                <div className="p-2 bg-white/5 rounded-full text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Walk-in Order</h4>
                                    <p className="text-xs text-neutral-400 mt-1">Ordering from the bar or for pickup? We&apos;ll call your name when ready.</p>
                                </div>
                            </div>
                        </div>
                    )}

                    {mode === "ADVANCE" && (
                        <div className="space-y-3">
                            <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">When are you arriving?</h3>
                            <div className="grid grid-cols-4 gap-2">
                                {timeOptions.map(time => (
                                    <button
                                        key={time}
                                        onClick={() => setAdvanceTime(time)}
                                        className={cn(
                                            "py-3 rounded-xl border text-sm font-semibold transition-all active:scale-95",
                                            advanceTime === time
                                                ? "bg-white/10 border-white/30 text-white shadow-lg shadow-white/10"
                                                : "bg-neutral-900 border-white/5 text-neutral-400 hover:bg-white/5 hover:border-white/10"
                                        )}
                                    >
                                        {time}
                                    </button>
                                ))}
                            </div>
                            <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 flex items-start gap-3">
                                <div className="p-2 bg-white/5 rounded-full text-white">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
                                    </svg>
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-white">Advance Order</h4>
                                    <p className="text-xs text-neutral-400 mt-1">We&apos;ll prepare your drinks so they&apos;re ready when you arrive. Payment required upfront.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* If table is pre-selected via URL, show strict badge */}
            {tableIdentifier && (
                <div className="bg-white/[0.02] border border-white/10 rounded-xl p-4 flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.5)] animate-pulse"></div>
                    <span className="font-semibold text-white">You are ordering for {tableIdentifier}</span>
                </div>
            )}

            <ProductList products={products} onAdd={addToCart} />
            <CartSheet
                items={cart}
                onRemove={removeFromCart}
                onClear={clearCart}
                tableIdentifier={finalTableIdentifier}
            />
        </div>
    );
}
