import { forgotPasswordAction } from "../actions";
import { Logo } from "@/app/components/ui/Logo";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
    const sp = await searchParams;
    const error = sp?.error as string | undefined;
    const success = sp?.success as string | undefined;

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-[#050505] p-8 text-white selection:bg-white/20">
            <div className="flex w-full max-w-[320px] flex-col animate-in fade-in zoom-in-95 duration-1000 fill-mode-both">

                {/* Header Section */}
                <div className="mb-16 flex flex-col items-center text-center">
                    <div className="mb-8">
                        <Logo className="h-24 w-24 text-white opacity-90" />
                    </div>
                    <h1 className="text-3xl font-bold leading-tight tracking-tight text-white/95">
                        Reset Password
                    </h1>
                    <p className="mt-4 text-[13px] font-medium leading-relaxed text-neutral-400/80">
                        Enter your email address and we'll send you a link to reset your password.
                    </p>
                </div>

                {/* Feedback Messages */}
                {error && (
                    <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-xs font-medium text-red-200">
                        {error === "invalid" && "Something went wrong. Please try again."}
                        {error === "missing" && "Please enter your email address."}
                    </div>
                )}

                {success && (
                    <div className="mb-6 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-center text-xs font-medium text-green-200">
                        Check your email for a link to reset your password.
                    </div>
                )}

                {!success && (
                    <form action={forgotPasswordAction} className="flex flex-col gap-5">
                        <div className="space-y-4">
                            <div className="relative group">
                                <input
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    placeholder="Email address"
                                    className="w-full border-b border-white/20 bg-transparent py-4 text-base text-white placeholder:text-neutral-600 focus:border-white focus:outline-none transition-colors"
                                />
                            </div>
                        </div>

                        <div className="mt-4">
                            <button
                                type="submit"
                                className="w-full rounded-full bg-white h-12 text-sm font-bold text-black hover:bg-neutral-200 active:scale-[0.98] transition-all"
                            >
                                Send Reset Link
                            </button>
                        </div>
                    </form>
                )}

                <div className="mt-12 text-center">
                    <p className="text-xs text-neutral-600 font-medium">
                        Remember your password?{" "}
                        <Link
                            href="/auth/login"
                            className="text-white hover:text-neutral-300 transition-colors"
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
