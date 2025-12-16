'use client';

import { useState } from 'react';
import { CustomerSearchDialog } from "./components/CustomerSearchDialog";
import type { CustomerResult } from "./wallet-actions";

type SessionType = 'OPEN' | 'FIXED';

interface StartSessionDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (data: {
        customerName: string;
        sessionType: SessionType;
        targetDurationMinutes: number | undefined;
        isMoneyGame: boolean;
        betAmount: number | undefined;
        profileId?: string;
    }) => void;
    tableName: string;
    hourlyRate: number;
}

export function StartSessionDialog({
    isOpen,
    onClose,
    onConfirm,
    tableName,
    hourlyRate,
}: StartSessionDialogProps) {
    const [customerName, setCustomerName] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
    const [searchOpen, setSearchOpen] = useState(false);

    const [sessionType, setSessionType] = useState<SessionType>('OPEN');
    const [targetDurationMinutes, setTargetDurationMinutes] = useState<number>(60);
    const [isMoneyGame, setIsMoneyGame] = useState(false);
    const [betAmount, setBetAmount] = useState<string>('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onConfirm({
            customerName,
            sessionType,
            targetDurationMinutes: sessionType === 'FIXED' ? targetDurationMinutes : undefined,
            isMoneyGame,
            betAmount: isMoneyGame ? Number(betAmount) : undefined,
            profileId: selectedCustomer?.id,
        });
        // Reset state? Or let parent handle unmount/close
    };

    const estimatedCost = sessionType === 'FIXED'
        ? (targetDurationMinutes / 60) * hourlyRate
        : 0; // Open time unknown

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">

                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-neutral-100">
                            Open {tableName}
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-neutral-400 hover:text-white"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="space-y-4">
                        {/* Customer Selection */}
                        <div>
                            <label className="mb-1 block text-sm font-medium text-neutral-400">
                                Customer
                            </label>
                            {selectedCustomer ? (
                                <div className="flex items-center justify-between rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2">
                                    <div>
                                        <div className="font-semibold text-emerald-400">{selectedCustomer.full_name}</div>
                                        {selectedCustomer.wallet?.balance !== undefined && (
                                            <div className="text-xs text-emerald-300/70">
                                                Wallet: ₱{selectedCustomer.wallet.balance.toFixed(2)}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setCustomerName("");
                                        }}
                                        className="ml-2 text-neutral-400 hover:text-white"
                                    >
                                        ✕
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customerName}
                                        onChange={(e) => setCustomerName(e.target.value)}
                                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        placeholder="Guest Name (Optional)"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setSearchOpen(true)}
                                        className="rounded-lg bg-neutral-800 px-3 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 border border-white/10"
                                    >
                                        Find Member
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Session Type */}
                        <div>
                            <label className="mb-2 block text-sm font-medium text-neutral-400">
                                Time Mode
                            </label>
                            <div className="grid grid-cols-2 gap-2 rounded-lg bg-white/5 p-1">
                                <button
                                    type="button"
                                    onClick={() => setSessionType('OPEN')}
                                    className={`rounded-md py-2 text-sm font-medium transition ${sessionType === 'OPEN'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Open Time
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setSessionType('FIXED')}
                                    className={`rounded-md py-2 text-sm font-medium transition ${sessionType === 'FIXED'
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'text-neutral-400 hover:text-white hover:bg-white/5'
                                        }`}
                                >
                                    Fixed Time
                                </button>
                            </div>
                            <p className="mt-2 text-xs text-neutral-500">
                                {sessionType === 'OPEN'
                                    ? "Timer runs indefinitely. Billed every 30 mins."
                                    : "Set a specific duration. Excess time charged per minute."}
                            </p>
                        </div>

                        {/* Fixed Time Options */}
                        {sessionType === 'FIXED' && (
                            <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                                <label className="mb-2 block text-sm font-medium text-neutral-400">
                                    Duration (Minutes)
                                </label>
                                <div className="flex gap-2 mb-2">
                                    {[60, 120, 180].map(mins => (
                                        <button
                                            key={mins}
                                            type="button"
                                            onClick={() => setTargetDurationMinutes(mins)}
                                            className={`flex-1 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${targetDurationMinutes === mins
                                                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400'
                                                : 'border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10'
                                                }`}
                                        >
                                            {mins / 60}h
                                        </button>
                                    ))}
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    value={targetDurationMinutes}
                                    onChange={(e) => setTargetDurationMinutes(parseInt(e.target.value) || 0)}
                                    className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                />
                                <div className="mt-1 text-right text-xs text-emerald-400">
                                    Base Cost: {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(estimatedCost)}
                                </div>
                            </div>
                        )}

                        {/* Money Game */}
                        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <label className="block text-sm font-medium text-white">
                                        Money Game
                                    </label>
                                    <p className="text-xs text-neutral-400">
                                        Collect 10% of bet as minimum table fee
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsMoneyGame(!isMoneyGame)}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-neutral-900 ${isMoneyGame ? 'bg-emerald-600' : 'bg-neutral-700'
                                        }`}
                                >
                                    <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isMoneyGame ? 'translate-x-6' : 'translate-x-1'
                                            }`}
                                    />
                                </button>
                            </div>

                            {isMoneyGame && (
                                <div className="mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <label className="mb-1 block text-xs font-medium text-neutral-400">
                                        Total Bet Amount
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2 text-neutral-500">₱</span>
                                        <input
                                            type="number"
                                            min="0"
                                            required
                                            value={betAmount}
                                            onChange={(e) => setBetAmount(e.target.value)}
                                            className="w-full rounded-lg border border-white/10 bg-black/40 pl-7 pr-4 py-2 text-white focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <div className="mt-2 text-xs text-emerald-400">
                                        Host Collection (10%): {new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(Number(betAmount || 0) * 0.10)}
                                    </div>
                                </div>
                            )}
                        </div>

                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-300 hover:bg-white/10 transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition active:scale-[0.98]"
                        >
                            Start Session
                        </button>
                    </div>
                </form>
            </div>

            <CustomerSearchDialog
                isOpen={searchOpen}
                onClose={() => setSearchOpen(false)}
                onSelectCustomer={(res) => {
                    if (res.fullCustomer) setSelectedCustomer(res.fullCustomer);
                    setCustomerName(res.name);
                    setSearchOpen(false);
                }}
            />
        </div >
    );
}
