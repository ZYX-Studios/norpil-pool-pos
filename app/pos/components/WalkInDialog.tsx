'use client';

import React, { useState } from 'react';

interface WalkInDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (customerName: string) => void;
}

export function WalkInDialog({
    isOpen,
    onClose,
    onConfirm,
}: WalkInDialogProps) {
    const [customerName, setCustomerName] = useState('');

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (customerName.trim()) {
            onConfirm(customerName.trim());
            setCustomerName('');
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl animate-in zoom-in-95 duration-200">
                <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-6">

                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold text-neutral-100">
                            New Walk-in Session
                        </h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-neutral-400 hover:text-white transition-colors"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-400">
                            Customer Name / Identifier
                        </label>
                        <input
                            type="text"
                            autoFocus
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                            placeholder="e.g. Table 5, Guy in Red Shirt..."
                        />
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
                            disabled={!customerName.trim()}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Create Session
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
