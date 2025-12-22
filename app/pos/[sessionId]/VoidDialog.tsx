"use client";

import { useState } from "react";
import { Modal } from "@/app/components/ui/Modal";

interface VoidDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (reason: string) => void;
    itemName: string;
}

export function VoidDialog({ isOpen, onClose, onConfirm, itemName }: VoidDialogProps) {
    const [reason, setReason] = useState("");

    const handleConfirm = () => {
        if (!reason.trim()) return;
        onConfirm(reason);
        setReason(""); // Reset for next time
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Void Item: ${itemName}`}
            description="This item has already been sent to the kitchen. Please provide a reason for removing it."
        >
            <div className="space-y-4">
                <div>
                    <label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
                        Reason for Void
                    </label>
                    <textarea
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. Customer changed mind, Kitchen error, Out of stock"
                        className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-neutral-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        rows={3}
                        autoFocus
                    />
                </div>
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 hover:bg-white/10"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={!reason.trim()}
                        className="rounded-xl bg-red-500/20 border border-red-500/30 px-4 py-2 text-sm font-medium text-red-200 hover:bg-red-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Confirm Void
                    </button>
                </div>
            </div>
        </Modal>
    );
}
