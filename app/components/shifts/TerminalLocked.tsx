"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function TerminalLocked({ lockerName }: { lockerName: string }) {
    const supabase = createSupabaseBrowserClient();

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        window.location.href = "/";
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-neutral-900 p-4 font-sans text-white">
            <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/5 p-8 text-center shadow-2xl backdrop-blur-xl">
                <div className="mb-6 flex justify-center">
                    <div className="rounded-full bg-red-500/20 p-4">
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                            className="h-12 w-12 text-red-500"
                        >
                            <path
                                fillRule="evenodd"
                                d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3c0-2.9-2.35-5.25-5.25-5.25zm3.75 8.25v-3a3.75 3.75 0 10-7.5 0v3h7.5z"
                                clipRule="evenodd"
                            />
                        </svg>
                    </div>
                </div>
                <h2 className="mb-2 text-2xl font-bold tracking-tight">Terminal Locked</h2>
                <p className="mb-8 text-neutral-400">
                    This POS terminal is currently being operated by{" "}
                    <span className="font-semibold text-white">{lockerName}</span>.
                </p>

                <div className="space-y-3">
                    <button
                        onClick={handleSignOut}
                        className="w-full rounded-xl border border-white/10 bg-white/5 py-4 text-sm font-semibold text-neutral-200 transition hover:bg-white/10 active:scale-[0.98]"
                    >
                        Sign out
                    </button>
                </div>
                <p className="mt-6 text-xs text-neutral-500">
                    Only one active cashier session is allowed at a time.
                </p>
            </div>
        </div>
    );
}
