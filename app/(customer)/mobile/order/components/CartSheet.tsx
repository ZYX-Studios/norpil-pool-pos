"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { placeOrderAction } from "../actions";
import { useRouter } from "next/navigation";

type CartItem = {
    product: { id: string; name: string; price: number };
    quantity: number;
};

type CartSheetProps = {
    items: CartItem[];
    onRemove: (productId: string) => void;
    onClear: () => void;
};

export function CartSheet({ items, onRemove, onClear }: CartSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const router = useRouter();

    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    if (count === 0) return null;

    async function handleCheckout() {
        if (isSubmitting) return;
        setIsSubmitting(true);

        const payload = items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }));

        const result = await placeOrderAction(payload);

        if (result.success) {
            alert("Order placed successfully!");
            onClear();
            setIsOpen(false);
            router.refresh();
            router.push("/mobile/wallet"); // Go to wallet to see transaction
        } else {
            alert(result.error || "Failed to place order.");
        }
        setIsSubmitting(false);
    }

    return (
        <>
            {/* Floating Button */}
            {!isOpen && (
                <div className="fixed bottom-20 left-0 right-0 px-6 z-40">
                    <button
                        onClick={() => setIsOpen(true)}
                        className="w-full bg-emerald-500 text-white h-14 rounded-2xl shadow-lg shadow-emerald-500/30 flex items-center justify-between px-6 font-semibold transition-transform active:scale-95"
                    >
                        <div className="flex items-center space-x-2">
                            <span className="bg-emerald-600 px-2 py-0.5 rounded text-sm">{count}</span>
                            <span>View Cart</span>
                        </div>
                        <span>₱{total.toLocaleString()}</span>
                    </button>
                </div>
            )}

            {/* Sheet Overlay */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
                    <div
                        className="bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 space-y-6 max-h-[80vh] overflow-y-auto"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-neutral-50">Your Order</h2>
                            <button onClick={() => setIsOpen(false)} className="text-neutral-400 hover:text-neutral-200">
                                Close
                            </button>
                        </div>

                        <div className="space-y-4">
                            {items.map(item => (
                                <div key={item.product.id} className="flex justify-between items-center">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-white/5 rounded-lg w-8 h-8 flex items-center justify-center text-sm font-medium text-neutral-300">
                                            {item.quantity}x
                                        </div>
                                        <div>
                                            <div className="font-medium text-neutral-50">{item.product.name}</div>
                                            <div className="text-sm text-neutral-400">₱{item.product.price}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className="font-medium text-neutral-50">₱{(item.product.price * item.quantity).toLocaleString()}</span>
                                        <button
                                            onClick={() => onRemove(item.product.id)}
                                            className="text-rose-400 hover:text-rose-300 text-sm"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="border-t border-white/10 pt-4 space-y-2">
                            <div className="flex justify-between text-lg font-bold text-neutral-50">
                                <span>Total</span>
                                <span>₱{total.toLocaleString()}</span>
                            </div>
                            <p className="text-xs text-neutral-500 text-center">Payment will be deducted from your wallet.</p>
                        </div>

                        <button
                            onClick={handleCheckout}
                            disabled={isSubmitting}
                            className="w-full bg-emerald-500 text-white h-14 rounded-xl font-bold text-lg shadow-lg shadow-emerald-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Processing..." : "Pay & Order"}
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
