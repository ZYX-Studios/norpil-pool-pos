"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { endShift, getExpectedCash } from "@/lib/shifts/actions";

interface EndShiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    shiftId: string;
    onShiftEnded?: () => void;
}

export function EndShiftModal({ isOpen, onClose, shiftId, onShiftEnded }: EndShiftModalProps) {
    const [actualCash, setActualCash] = useState("");
    const [notes, setNotes] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isCalculating, setIsCalculating] = useState(true);
    const [stats, setStats] = useState<{ starting: number; sales: number; expected: number } | null>(null);
    const [error, setError] = useState("");
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    useEffect(() => {
        if (isOpen && shiftId) {
            setIsCalculating(true);
            getExpectedCash(shiftId)
                .then(setStats)
                .catch((e) => setError(e.message))
                .finally(() => setIsCalculating(false));
        }
    }, [isOpen, shiftId]);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!shiftId) return;
        setError("");
        setIsLoading(true);

        try {
            const val = parseFloat(actualCash);
            if (isNaN(val) || val < 0) throw new Error("Invalid amount");
            await endShift(shiftId, val, notes);

            if (onShiftEnded) {
                await onShiftEnded();
            }
            onClose();
        } catch (err: any) {
            setError(err.message || "Failed to end shift");
            setIsLoading(false);
        }
    }

    if (!isOpen || !mounted) return null;

    const expected = stats?.expected ?? 0;
    const actual = parseFloat(actualCash) || 0;
    const diff = actual - expected;
    const isShort = diff < 0;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-xl animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl ring-1 ring-white/5">
                <div className="p-8 pb-6">
                    <h2 className="text-2xl font-bold text-white">End Shift Report</h2>
                    <p className="mt-1 text-sm text-neutral-400">Reconcile cash drawer before signing out.</p>
                </div>

                {isCalculating ? (
                    <div className="flex flex-col items-center justify-center px-8 py-12 text-neutral-400">
                        <svg className="mb-3 h-8 w-8 animate-spin text-neutral-600" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span className="text-sm font-medium">Calculating totals...</span>
                    </div>
                ) : stats ? (
                    <div className="px-8 pb-8 space-y-6">
                        <div className="grid grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Starting</div>
                                <div className="font-mono text-xl font-semibold text-neutral-200">₱{stats.starting.toFixed(2)}</div>
                            </div>
                            <div className="rounded-2xl border border-white/5 bg-white/5 p-4">
                                <div className="mb-1 text-xs font-bold uppercase tracking-wider text-neutral-500">Sales</div>
                                <div className="font-mono text-xl font-semibold text-emerald-400">+₱{stats.sales.toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-6 py-4">
                            <span className="text-sm font-bold uppercase tracking-wider text-blue-200">Expected</span>
                            <span className="font-mono text-3xl font-bold text-blue-50">₱{stats.expected.toFixed(2)}</span>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Actual Cash Count</label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-white">₱</span>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={actualCash}
                                        onChange={(e) => setActualCash(e.target.value)}
                                        className="block w-full rounded-2xl border border-white/10 bg-black/40 py-4 pl-9 pr-4 text-2xl font-bold text-white placeholder-neutral-700 transition-colors focus:border-white/20 focus:bg-black/60 focus:outline-none focus:ring-0"
                                        placeholder="0.00"
                                        required
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {actualCash && (
                                <div className={`flex items-center justify-between rounded-xl px-4 py-3 text-sm font-medium border ${Math.abs(diff) < 0.1
                                        ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                                        : isShort
                                            ? "border-rose-500/20 bg-rose-500/10 text-rose-400"
                                            : "border-amber-500/20 bg-amber-500/10 text-amber-400"
                                    }`}>
                                    <span>{Math.abs(diff) < 0.1 ? "Matches Expected" : isShort ? "Shortage" : "Overage"}</span>
                                    <span className="font-mono text-lg font-bold">{diff > 0 ? "+" : ""}{diff.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="space-y-2">
                                <label className="block text-xs font-bold uppercase tracking-wider text-neutral-500">Notes</label>
                                <textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    rows={2}
                                    className="block w-full rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-200 placeholder-neutral-600 focus:border-white/20 focus:bg-white/10 focus:outline-none focus:ring-0"
                                    placeholder="Explain any discrepancies..."
                                />
                            </div>

                            {error && <p className="text-center text-sm font-medium text-rose-400">{error}</p>}

                            <div className="grid grid-cols-2 gap-3 pt-2">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="rounded-xl border border-white/10 bg-white/5 py-4 text-sm font-bold text-neutral-400 hover:bg-white/10 hover:text-white transition-colors"
                                    disabled={isLoading}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="rounded-xl bg-white text-neutral-900 py-4 text-sm font-bold hover:bg-neutral-200 disabled:opacity-50 disabled:hover:bg-white transition-colors"
                                >
                                    {isLoading ? "End Shift" : "Confirm End"}
                                </button>
                            </div>
                        </form>
                    </div>
                ) : (
                    <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-6 mx-8 mb-8 text-center">
                        <p className="text-red-400 mb-2">Failed to load shift records.</p>
                        <button onClick={onClose} className="text-sm font-medium text-red-300 hover:text-red-200 underline">Close</button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
