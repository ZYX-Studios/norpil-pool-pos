import { updatePasswordAction } from "../actions";
import { Logo } from "@/app/components/ui/Logo";

export const dynamic = "force-dynamic";

export default async function UpdatePasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
    const sp = await searchParams;
    const error = sp?.error as string | undefined;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-8 text-white selection:bg-white/20">
            <div className="flex w-full max-w-[320px] flex-col animate-in fade-in zoom-in-95 duration-1000 fill-mode-both">

                {/* Header Section */}
                <div className="mb-16 flex flex-col items-center text-center">
                    <div className="mb-8">
                        <Logo className="h-24 w-24 text-white opacity-90" />
                    </div>
                    <h1 className="text-3xl font-bold leading-tight tracking-tight text-white/95">
                        New Password
                    </h1>
                    <p className="mt-4 text-[13px] font-medium leading-relaxed text-neutral-400/80">
                        Please enter your new password below.
                    </p>
                </div>

                {/* Error Handling */}
                {error && (
                    <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs font-medium text-red-200">
                        {error === "missing" && "Please enter all fields."}
                        {error === "match" && "Passwords do not match."}
                        {error === "update-failed" && "Failed to update password. Please try again."}
                    </div>
                )}

                <form action={updatePasswordAction} className="flex flex-col gap-5">
                    <div className="space-y-4">
                        <div className="relative group">
                            <input
                                name="password"
                                type="password"
                                required
                                placeholder="New Password"
                                className="w-full border-b border-white/20 bg-transparent py-4 text-base text-white placeholder:text-neutral-600 focus:border-white focus:outline-none transition-colors"
                            />
                        </div>
                        <div className="relative group">
                            <input
                                name="confirmPassword"
                                type="password"
                                required
                                placeholder="Confirm New Password"
                                className="w-full border-b border-white/20 bg-transparent py-4 text-base text-white placeholder:text-neutral-600 focus:border-white focus:outline-none transition-colors"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <button
                            type="submit"
                            className="w-full rounded-full bg-white h-12 text-sm font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
                        >
                            Update Password
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
