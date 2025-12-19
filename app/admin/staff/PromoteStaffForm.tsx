"use client";

import { useActionState } from "react";
import { promoteUserAction } from "./actions";

const initialState = {
    message: "",
    error: "",
};

export function PromoteStaffForm() {
    const [state, formAction, isPending] = useActionState(promoteUserAction, initialState);

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur">
            <h2 className="text-lg font-semibold mb-4">Promote Customer to Staff</h2>

            <form action={formAction} className="flex gap-3 items-end">
                <div className="flex-1 space-y-1">
                    <label className="text-xs text-neutral-400">Customer Email</label>
                    <input
                        name="email"
                        type="email"
                        placeholder="customer@example.com"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-neutral-50 focus:border-emerald-500 focus:outline-none"
                        required
                    />
                </div>
                <div className="w-40 space-y-1">
                    <label className="text-xs text-neutral-400">Role</label>
                    <select
                        name="role"
                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-neutral-50 focus:border-emerald-500 focus:outline-none"
                    >
                        <option value="CASHIER">CASHIER</option>
                        <option value="WAITER">WAITER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OWNER">OWNER</option>
                    </select>
                </div>
                <button
                    type="submit"
                    disabled={isPending}
                    className="rounded-xl bg-emerald-500 px-6 py-2.5 font-semibold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isPending ? "Promoting..." : "Promote"}
                </button>
            </form>

            {state?.error && (
                <div className="mt-3 text-sm text-rose-400">
                    ⚠️ {state.error}
                </div>
            )}
            {state?.message && (
                <div className="mt-3 text-sm text-emerald-400">
                    ✅ {state.message}
                </div>
            )}
        </div>
    );
}
