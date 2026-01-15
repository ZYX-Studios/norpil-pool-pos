"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createExpense } from "@/app/admin/reports/actions";

interface AddExpenseDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function AddExpenseDialog({ isOpen, onClose }: AddExpenseDialogProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Default to today's date in YYYY-MM-DD.
    const today = new Date().toISOString().split('T')[0];

    async function handleSubmit(formData: FormData) {
        setIsSubmitting(true);
        try {
            await createExpense(formData);
            onClose();
        } catch (e) {
            console.error("Expense error:", e);
        } finally {
            setIsSubmitting(false);
        }
    }

    if (!isOpen || !mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 shadow-2xl">
                <div className="flex items-center justify-between p-6 pb-0">
                    <h2 className="text-xl font-bold text-neutral-100">Add Operating Expense</h2>
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

                <form action={handleSubmit} className="flex flex-col gap-4 p-6">
                    <div className="space-y-1">
                        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Date
                        </label>
                        <input
                            type="date"
                            name="expense_date"
                            defaultValue={today}
                            className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            required
                        />
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Category
                        </label>
                        <select
                            name="category"
                            className="w-full appearance-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all"
                            required
                        >
                            <option value="" className="bg-neutral-900 text-neutral-500">Select category...</option>
                            <option value="RENTAL" className="bg-neutral-900">Rental</option>
                            <option value="UTILITIES" className="bg-neutral-900">Utilities (Electricity, Water)</option>
                            <option value="MANPOWER" className="bg-neutral-900">Manpower</option>
                            <option value="INVENTORY" className="bg-neutral-900">Inventory</option>
                            <option value="BEVERAGES" className="bg-neutral-900">Beverages (purchases)</option>
                            <option value="CLEANING_MATERIALS" className="bg-neutral-900">Cleaning materials</option>
                            <option value="TRANSPORTATION" className="bg-neutral-900">Transportation</option>
                            <option value="PAYROLL" className="bg-neutral-900">Payroll</option>
                            <option value="MARKETING" className="bg-neutral-900">Marketing</option>
                            <option value="PREDATOR_COMMISSION" className="bg-neutral-900">Predator (table commission)</option>
                            <option value="OTHER" className="bg-neutral-900">Other</option>
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Amount
                        </label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500">₱</span>
                            <input
                                type="number"
                                name="amount"
                                min="0"
                                step="0.01"
                                placeholder="0.00"
                                className="w-full rounded-xl border border-white/10 bg-white/5 pl-8 pr-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="block text-xs font-medium uppercase tracking-wider text-neutral-400">
                            Note (Optional)
                        </label>
                        <textarea
                            name="note"
                            rows={2}
                            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50 transition-all placeholder:text-neutral-600"
                            placeholder="Brief description..."
                        />
                    </div>

                    <div className="flex gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-neutral-300 hover:bg-white/10 transition disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 transition active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "Saving..." : "Save Expense"}
                        </button>
                    </div>
                </form>
            </div>
        </div>,
        document.body
    );
}
