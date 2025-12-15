"use client";

import { useState } from "react";
import { PaymentCodeDialog } from "./PaymentCodeDialog";

export function TopUpButton() {
    const [isOpen, setIsOpen] = useState(false);
    const [codeOpen, setCodeOpen] = useState(false);

    return (
        <>
            <div className="grid grid-cols-2 gap-3">
                <button
                    onClick={() => setCodeOpen(true)}
                    className="w-full rounded-xl bg-white/10 border border-white/20 py-3 font-semibold text-white shadow-lg active:scale-95 transition hover:bg-white/20"
                >
                    Pay Bill
                </button>
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full rounded-xl bg-white text-black py-3 font-semibold shadow-lg shadow-white/10 active:scale-95 transition hover:bg-white/90"
                >
                    + Top Up
                </button>
            </div>

            <PaymentCodeDialog isOpen={codeOpen} onClose={() => setCodeOpen(false)} />

            {isOpen && (
                <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm overflow-y-auto">
                    <div className="min-h-screen flex items-center justify-center p-6">
                        <div className="w-full max-w-sm rounded-2xl bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-800 border border-white/10 p-8 shadow-2xl relative">
                            <button
                                onClick={() => setIsOpen(false)}
                                className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition-all"
                            >
                                ✕
                            </button>

                            <div className="text-center space-y-6">
                                <div className="mx-auto h-20 w-20 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-3xl shadow-inner">
                                    💎
                                </div>

                                <div>
                                    <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">Top Up Required</h2>
                                    <p className="text-neutral-400 leading-relaxed text-sm">
                                        Please visit the counter and show your QR code (or tell your name) to the cashier to add funds to your wallet.
                                    </p>
                                </div>

                                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                                    <p className="text-xs uppercase tracking-wider text-neutral-500 font-semibold mb-1">Your ID</p>
                                    <p className="text-sm font-mono text-white break-all">
                                        (Show your Profile QR)
                                    </p>
                                </div>

                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="w-full rounded-xl bg-white/10 border border-white/20 py-3 font-semibold text-white hover:bg-white/20 transition-all"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
