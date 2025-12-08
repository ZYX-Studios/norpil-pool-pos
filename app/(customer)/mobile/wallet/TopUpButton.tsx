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
                    className="w-full rounded-xl bg-neutral-100 py-3 font-semibold text-neutral-900 shadow-lg active:scale-95 transition hover:bg-white"
                >
                    Pay Bill
                </button>
                <button
                    onClick={() => setIsOpen(true)}
                    className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-neutral-900 shadow-lg shadow-emerald-500/20 active:scale-95 transition hover:bg-emerald-400"
                >
                    + Top Up
                </button>
            </div>

            <PaymentCodeDialog isOpen={codeOpen} onClose={() => setCodeOpen(false)} />

            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-6">
                    <div className="w-full max-w-sm rounded-3xl bg-neutral-900 border border-neutral-800 p-8 shadow-2xl relative">
                        <button
                            onClick={() => setIsOpen(false)}
                            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white"
                        >
                            ✕
                        </button>

                        <div className="text-center space-y-6">
                            <div className="mx-auto h-20 w-20 rounded-full bg-emerald-500/20 flex items-center justify-center text-3xl">
                                💎
                            </div>

                            <div>
                                <h2 className="text-2xl font-bold text-white mb-2">Top Up Required</h2>
                                <p className="text-neutral-400 leading-relaxed">
                                    Please visit the counter and show your QR code (or tell your name) to the cashier to add funds to your wallet.
                                </p>
                            </div>

                            <div className="p-4 rounded-xl bg-neutral-800 border border-neutral-700">
                                <p className="text-xs uppercase tracking-wider text-neutral-500 font-bold mb-1">Your ID</p>
                                <p className="text-sm font-mono text-emerald-400 break-all">
                                    (Show your Profile QR)
                                </p>
                            </div>

                            <button
                                onClick={() => setIsOpen(false)}
                                className="w-full rounded-xl bg-white/10 py-3 font-semibold text-white hover:bg-white/20 transition"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
