"use client";

import { KitchenBoard } from "./KitchenBoard";

interface KitchenDialogProps {
    isOpen: boolean;
    onClose: () => void;
}

export function KitchenDialog({ isOpen, onClose }: KitchenDialogProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="w-full h-full max-w-7xl flex flex-col rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/20">
                    <h2 className="text-xl font-bold text-neutral-100">
                        Kitchen Orders
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-white/10 text-neutral-400 hover:text-white transition"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                <div className="flex-1 overflow-hidden p-6 bg-neutral-950/50">
                    <KitchenBoard />
                </div>
            </div>
        </div>
    );
}
