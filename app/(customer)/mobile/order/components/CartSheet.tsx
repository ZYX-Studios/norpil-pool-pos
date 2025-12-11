"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { placeOrderAction } from "../actions";
import { useRouter } from "next/navigation";

// Define strict types matching server action
type CartItem = {
    product: { id: string; name: string; price: number };
    quantity: number;
};

type CartSheetProps = {
    items: CartItem[];
    onRemove: (productId: string) => void;
    onClear: () => void;
    tableIdentifier?: string;
};

export function CartSheet({ items, onRemove, onClear, tableIdentifier }: CartSheetProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"WALLET" | "CHARGE_TO_TABLE">("WALLET");
    const [error, setError] = useState<string | null>(null);
    const [successMsg, setSuccessMsg] = useState<string | null>(null);

    // Custom Confirmation Modal State
    const [showConfirmation, setShowConfirmation] = useState(false);

    const router = useRouter();

    const total = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
    const count = items.reduce((sum, item) => sum + item.quantity, 0);

    if (count === 0) return null;

    function initiateCheckout() {
        if (isSubmitting) return;
        setError(null);
        setSuccessMsg(null);
        setShowConfirmation(true);
    }

    async function handleConfirmCheckout() {
        setShowConfirmation(false);
        setIsSubmitting(true);

        // Ensure we pass a simplified payload to avoid circular JSON issues or sending unnecessary data
        const payload = items.map(item => ({
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price
        }));

        try {
            const result = await placeOrderAction(payload, tableIdentifier, paymentMethod);

            if (result.success) {
                setSuccessMsg(paymentMethod === "CHARGE_TO_TABLE"
                    ? "Order sent to kitchen! (Charged to Table)"
                    : "Order paid and sent to kitchen!"
                );

                // Delay closing to show success message
                setTimeout(() => {
                    onClear();
                    setIsOpen(false);
                    setSuccessMsg(null);
                    router.refresh();
                    if (paymentMethod === "WALLET") {
                        router.push("/mobile/wallet");
                    }
                }, 1500);
            } else {
                setError(result.error);
            }
        } catch (err) {
            console.error("Checkout error:", err);
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setIsSubmitting(false);
        }
    }

    // Reset state when opening/closing
    const toggleOpen = (open: boolean) => {
        setIsOpen(open);
        if (!open) {
            setError(null);
            setSuccessMsg(null);
            setShowConfirmation(false);
        }
    };

    return (
        <>
            {/* Floating Button - Raised higher to avoid nav bar overlap */}
            {!isOpen && (
                <div className="fixed bottom-24 left-0 right-0 px-6 z-40">
                    <button
                        onClick={() => toggleOpen(true)}
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
                <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm" onClick={() => toggleOpen(false)}>
                    <div
                        className="bg-neutral-900 border-t border-white/10 rounded-t-3xl p-6 space-y-6 max-h-[85vh] overflow-y-auto pb-24" // Extra padding bottom for safe area
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-bold text-neutral-50 ui-font-sans">Review Order</h2>
                            <button onClick={() => toggleOpen(false)} className="text-neutral-400 hover:text-neutral-200">
                                Close
                            </button>
                        </div>

                        {/* Error / Success Messages */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                {error}
                            </div>
                        )}
                        {successMsg && (
                            <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl text-sm font-medium animate-in fade-in slide-in-from-top-2">
                                {successMsg}
                            </div>
                        )}

                        {/* Items List */}
                        <div className="space-y-4">
                            {items.map(item => (
                                <div key={item.product.id} className="flex justify-between items-center bg-white/5 p-3 rounded-xl">
                                    <div className="flex items-center space-x-3">
                                        <div className="bg-black/20 rounded-lg w-8 h-8 flex items-center justify-center text-sm font-medium text-neutral-300">
                                            {item.quantity}x
                                        </div>
                                        <div>
                                            <div className="font-medium text-neutral-50">{item.product.name}</div>
                                            <div className="text-xs text-neutral-400">₱{item.product.price} each</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center space-x-3">
                                        <span className="font-medium text-neutral-50">₱{(item.product.price * item.quantity).toLocaleString()}</span>
                                        <button
                                            onClick={() => onRemove(item.product.id)}
                                            className="p-1 px-2 bg-rose-500/10 text-rose-400 rounded-lg text-xs hover:bg-rose-500/20"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Payment Selection */}
                        <div className="border-t border-white/10 pt-4 space-y-3">
                            <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider">Payment Method</h3>

                            <div className="grid grid-cols-1 gap-2">
                                {/* Wallet Option */}
                                <button
                                    onClick={() => setPaymentMethod("WALLET")}
                                    className={cn(
                                        "flex items-center justify-between p-4 rounded-xl border transition-all",
                                        paymentMethod === "WALLET"
                                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                            : "border-white/10 bg-white/5 text-neutral-400"
                                    )}
                                >
                                    <span className="font-semibold">Wallet Balance</span>
                                    {paymentMethod === "WALLET" && (
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </button>

                                {/* Charge to Table Option */}
                                {tableIdentifier && (
                                    <button
                                        onClick={() => setPaymentMethod("CHARGE_TO_TABLE")}
                                        className={cn(
                                            "flex items-center justify-between p-4 rounded-xl border transition-all",
                                            paymentMethod === "CHARGE_TO_TABLE"
                                                ? "border-emerald-500 bg-emerald-500/10 text-emerald-400"
                                                : "border-white/10 bg-white/5 text-neutral-400"
                                        )}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-semibold">Charge to Table</span>
                                            <span className="text-xs opacity-70">Pay when session ends</span>
                                        </div>
                                        {paymentMethod === "CHARGE_TO_TABLE" && (
                                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                                            </svg>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Summary & Action */}
                        <div className="pt-2 space-y-4">
                            <div className="flex justify-between text-xl font-bold text-neutral-50 px-2">
                                <span>Total</span>
                                <span>₱{total.toLocaleString()}</span>
                            </div>

                            <button
                                onClick={initiateCheckout}
                                disabled={isSubmitting || !!successMsg}
                                className={cn(
                                    "w-full h-14 rounded-xl font-bold text-lg shadow-lg transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed",
                                    paymentMethod === "CHARGE_TO_TABLE"
                                        ? "bg-amber-500 text-amber-950 hover:bg-amber-400 shadow-amber-500/20"
                                        : "bg-emerald-500 text-white hover:bg-emerald-400 shadow-emerald-500/20"
                                )}
                            >
                                {isSubmitting
                                    ? "Processing..."
                                    : successMsg
                                        ? "Success!"
                                        : paymentMethod === "CHARGE_TO_TABLE"
                                            ? "Place Order (Pay Later)"
                                            : "Pay & Place Order"
                                }
                            </button>
                            <p className="text-xs text-neutral-500 text-center px-4">
                                {paymentMethod === "CHARGE_TO_TABLE"
                                    ? "Order will be added to your table's running bill."
                                    : "Payment will be immediately deducted from wallet."}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Custom Confirmation Modal */}
            {showConfirmation && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in" onClick={() => setShowConfirmation(false)}>
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm space-y-4 shadow-2xl scale-100" onClick={e => e.stopPropagation()}>
                        <div className="text-center space-y-2">
                            <div className="mx-auto w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-400 mb-4">
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                                </svg>
                            </div>
                            <h3 className="text-xl font-bold text-neutral-50">Confirm Order</h3>
                            <p className="text-neutral-400">
                                You are about to pay <span className="text-white font-bold">₱{total.toLocaleString()}</span> via
                                <span className={cn("font-bold ml-1", paymentMethod === "CHARGE_TO_TABLE" ? "text-amber-400" : "text-emerald-400")}>
                                    {paymentMethod === "CHARGE_TO_TABLE" ? "Charge to Table" : "Wallet"}
                                </span>.
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3 pt-4">
                            <button
                                onClick={() => setShowConfirmation(false)}
                                className="flex items-center justify-center px-4 py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-xl font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleConfirmCheckout}
                                className="flex items-center justify-center px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-500/20"
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
