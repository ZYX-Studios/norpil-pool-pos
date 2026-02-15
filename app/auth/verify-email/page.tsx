import Link from "next/link";

export default function VerifyEmailPage() {
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-4 text-center">
            <div className="w-full max-w-sm space-y-8">
                <div className="space-y-4">
                    <div className="mx-auto w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center text-3xl">
                        ✉️
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Check your email</h1>
                    <p className="text-neutral-400">
                        We&apos;ve sent you a confirmation link. Please check your inbox to verify your account.
                    </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                    <p className="text-sm text-neutral-300">
                        Once verified, you can sign in to access your account.
                    </p>
                </div>

                <Link
                    href="/auth/login"
                    className="block w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                >
                    Back to Sign In
                </Link>
            </div>
        </div>
    );
}
