import { signupAction } from "../actions";
import Link from "next/link";

export default async function SignupPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string }>;
}) {
    const sp = await searchParams;
    const error = sp?.error;
    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-4">
            <div className="w-full max-w-sm space-y-8">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight text-neutral-50">Create Account</h1>
                    <p className="text-neutral-400">Join NORPIL BILLIARDS today.</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/5 p-8 shadow-lg backdrop-blur">
                    <form action={signupAction} className="space-y-6">
                        <div className="space-y-2">
                            <label htmlFor="fullName" className="text-sm font-medium text-neutral-200">
                                Full Name
                            </label>
                            <input
                                id="fullName"
                                name="fullName"
                                type="text"
                                required
                                className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-neutral-50 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="John Doe"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="email" className="text-sm font-medium text-neutral-200">
                                Email
                            </label>
                            <input
                                id="email"
                                name="email"
                                type="email"
                                required
                                className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-neutral-50 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="name@example.com"
                            />
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="password" className="text-sm font-medium text-neutral-200">
                                Password
                            </label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                required
                                minLength={6}
                                className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-neutral-50 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors"
                                placeholder="••••••••"
                            />
                            <p className="text-xs text-neutral-500">Must be at least 6 characters.</p>
                        </div>

                        <div className="space-y-2">
                            <label htmlFor="ranking" className="text-sm font-medium text-neutral-200">
                                Self Rating
                            </label>
                            <div className="relative">
                                <select
                                    id="ranking"
                                    name="ranking"
                                    required
                                    defaultValue=""
                                    className="w-full rounded-xl border border-white/10 bg-neutral-900/50 px-4 py-3 text-neutral-50 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-colors appearance-none"
                                >
                                    <option value="" disabled>Select your rank</option>
                                    {[1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 5.5, 6.0, 6.5, 7.0].map((val) => (
                                        <option key={val} value={val.toFixed(1)} className="bg-neutral-900">
                                            {val.toFixed(1)}
                                        </option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                                    <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                                        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z" />
                                    </svg>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500">Rate your skill level.</p>
                        </div>

                        {error && (
                            <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400 border border-rose-500/20 text-center">
                                {error === "missing" ? "Please fill in all fields." : error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full rounded-xl bg-emerald-500 py-3 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98]"
                        >
                            Sign Up
                        </button>
                    </form>
                </div>

                <p className="text-center text-sm text-neutral-400">
                    Already have an account?{" "}
                    <Link href="/auth/login" className="font-medium text-emerald-400 hover:text-emerald-300 transition-colors">
                        Sign in
                    </Link>
                </p>
            </div>
        </div>
    );
}
