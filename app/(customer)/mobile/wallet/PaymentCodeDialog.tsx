"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PaymentCodeDialog({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const [code, setCode] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [timeLeft, setTimeLeft] = useState(300); // 5 minutes
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    const supabase = createSupabaseBrowserClient();
    const router = useRouter();

    // Reset success state when reopening or regenerating
    useEffect(() => {
        if (isOpen) {
            setPaymentSuccess(false);
            generateCode();
        }
    }, [isOpen]);

    useEffect(() => {
        if (!code || timeLeft <= 0) return;

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [code, timeLeft]);

    const generateCode = async () => {
        setLoading(true);
        setCode(null);
        try {
            const { data, error } = await supabase.rpc("generate_payment_code");
            if (error) throw error;
            setCode(data);
            setTimeLeft(300);
        } catch (err) {
            console.error("Failed to generate code:", err);
        } finally {
            setLoading(false);
        }
    };

    // Listen for payment confirmation
    useEffect(() => {
        if (!code) return;

        const channel = supabase
            .channel('payment_code_status')
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'payment_codes',
                    filter: `code=eq.${code}`,
                },
                (payload) => {
                    const newStatus = payload.new.status;
                    if (newStatus === 'USED') {
                        // Payment Confirmed
                        setPaymentSuccess(true);
                        // Refresh the page data (balance) in the background
                        router.refresh();
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [code, supabase, router]);

    if (!isOpen) return null;

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, "0")}`;
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur p-6">
            <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl relative text-center space-y-6">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                >
                    ✕
                </button>

                {paymentSuccess ? (
                    <div className="py-8 animate-in fade-in zoom-in duration-300">
                        <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-4xl mb-4 text-emerald-400">
                            ✓
                        </div>
                        <h2 className="text-2xl font-bold text-white mb-2">Payment Successful!</h2>
                        <p className="text-neutral-400">Your wallet has been charged.</p>

                        <button
                            onClick={onClose}
                            className="mt-6 w-full rounded-2xl bg-emerald-500 py-3 font-bold text-neutral-900 shadow-lg hover:bg-emerald-400"
                        >
                            Done
                        </button>
                    </div>
                ) : (
                    <>
                        <div>
                            <h2 className="text-2xl font-bold text-white mb-2">Payment Code</h2>
                            <p className="text-neutral-400">Show this code to the cashier</p>
                        </div>

                        <div className="py-8">
                            {loading ? (
                                <div className="animate-pulse flex justify-center gap-2">
                                    <div className="h-4 w-4 rounded-full bg-emerald-500"></div>
                                    <div className="h-4 w-4 rounded-full bg-emerald-500 delay-75"></div>
                                    <div className="h-4 w-4 rounded-full bg-emerald-500 delay-150"></div>
                                </div>
                            ) : (
                                <>
                                    <div className="text-4xl sm:text-6xl font-mono font-bold text-emerald-400 tracking-wider sm:tracking-widest">
                                        {code ? code.match(/.{1,3}/g)?.join(" ") : "--- ---"}
                                    </div>
                                    <p className="text-sm font-medium text-emerald-500/60 mt-4">
                                        Expires in {formatTime(timeLeft)}
                                    </p>
                                </>
                            )}
                        </div>

                        <p className="text-xs text-neutral-500">
                            This code is valid for one-time use only. <br />
                            Do not share this with anyone else.
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
