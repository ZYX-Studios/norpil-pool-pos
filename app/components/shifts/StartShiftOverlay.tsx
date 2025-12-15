"use client";

import { useState, useTransition } from "react";
import { startShift } from "@/lib/shifts/actions";

export function StartShiftOverlay() {
    const [startingCash, setStartingCash] = useState("");
    const [isPending, startTransition] = useTransition();

    const handleSubmit = () => {
        const amount = parseFloat(startingCash);
        if (isNaN(amount) || amount < 0) return;

        startTransition(async () => {
            await startShift(amount);
        });
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-in fade-in duration-300">
            <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-neutral-900/90 p-8 shadow-2xl backdrop-blur-2xl ring-1 ring-white/5">
                <div className="mb-8 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={1.5}
                            stroke="currentColor"
                            className="h-8 w-8 text-emerald-400"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
                            />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white">Start Shift</h2>
                    <p className="mt-2 text-sm text-neutral-400">
                        Enter your opening cash count to unlock the POS terminal.
                    </p>
                </div>

                <div className="mb-8 space-y-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-500">
                        Starting Cash
                    </label>
                    <div className="relative group">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-emerald-500">
                            ₱
                        </span>
                        <input
                            type="number"
                            value={startingCash}
                            onChange={(e) => setStartingCash(e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-2xl border border-white/10 bg-white/5 py-4 pl-9 pr-4 text-2xl font-bold text-white placeholder-neutral-700 transition-colors focus:border-emerald-500/50 focus:bg-white/10 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleSubmit();
                            }}
                        />
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={!startingCash || isPending}
                    className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 hover:shadow-emerald-500/30 active:scale-[0.98] disabled:opacity-50 disabled:shadow-none"
                >
                    {isPending ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Starting Switch...
                        </span>
                    ) : (
                        "Start Shift"
                    )}
                </button>
            </div>
        </div>
    );
}
