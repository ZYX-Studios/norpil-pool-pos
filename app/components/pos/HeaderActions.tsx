"use client";

import { useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/auth/actions";
import { EndShiftModal } from "@/app/components/shifts/EndShiftModal";
import { AddExpenseDialog } from "@/app/pos/components/AddExpenseDialog";

type HeaderActionsProps = {
    user: any;
    staff: any;
    authError?: string;
    activeShift: {
        id: string;
        started_at: string;
        starting_cash: number;
    } | null;
};

export function HeaderActions({ user, staff, authError, activeShift }: HeaderActionsProps) {
    const [showEndModal, setShowEndModal] = useState(false);
    const [pendingSignOut, setPendingSignOut] = useState(false);
    const [showExpenseDialog, setShowExpenseDialog] = useState(false);

    const handleSignOutClick = (e: React.FormEvent) => {
        if (activeShift) {
            e.preventDefault();
            setShowEndModal(true);
            setPendingSignOut(true);
        }
        // If no active shift, let the form submit naturally
    };

    const handleShiftEnded = async () => {
        if (pendingSignOut) {
            await logoutAction();
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm text-neutral-300">
            {activeShift && (
                <>
                    <div className="flex items-center gap-3 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="hidden text-xs font-medium text-emerald-400 sm:inline-block">
                            Shift Active
                        </span>
                        <button
                            onClick={() => setShowEndModal(true)}
                            className="ml-2 rounded-lg bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30"
                        >
                            End Shift
                        </button>
                    </div>

                    <EndShiftModal
                        isOpen={showEndModal}
                        onClose={() => {
                            setShowEndModal(false);
                            setPendingSignOut(false);
                        }}
                        shiftId={activeShift.id}
                        onShiftEnded={handleShiftEnded}
                    />
                </>
            )}

            <span className="hidden sm:inline text-neutral-400">
                {staff?.name ?? (authError === "supabase_unreachable" ? "Offline" : "Guest")} ·{" "}
                {staff?.role ?? "STAFF"}
            </span>

            {activeShift && (
                <>
                    <button
                        onClick={() => setShowExpenseDialog(true)}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-medium hover:bg-white/10 hover:text-white"
                    >
                        Expenses
                    </button>
                    <AddExpenseDialog
                        isOpen={showExpenseDialog}
                        onClose={() => setShowExpenseDialog(false)}
                    />
                </>
            )}

            <Link
                href="/admin"
                className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs sm:text-sm font-medium hover:bg-white/10 hover:text-white"
            >
                Admin
            </Link>

            <form action={logoutAction} onSubmit={handleSignOutClick}>
                <button
                    type="submit"
                    className="rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs sm:text-sm font-medium text-neutral-200 hover:bg-black/70 hover:text-white"
                >
                    Sign out
                </button>
            </form>
        </div>
    );
}
