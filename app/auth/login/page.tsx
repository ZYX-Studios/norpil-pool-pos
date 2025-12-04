import { loginAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const sp = await searchParams;
	const error = sp?.error as string | undefined;

	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-neutral-50">
			<div className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 shadow-lg shadow-black/60 backdrop-blur">
				<div className="mb-4 text-center">
					<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Norpil Billiards</div>
					<h1 className="mt-1 text-lg font-semibold text-neutral-50">Staff Sign In</h1>
					<p className="mt-1 text-xs text-neutral-400">Use your email and password to access the POS.</p>
				</div>
				{error === "invalid" && (
					<div className="mb-3 rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
						Invalid email or password.
					</div>
				)}
				{error === "missing" && (
					<div className="mb-3 rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
						Please enter both email and password.
					</div>
				)}
				<form action={loginAction} className="space-y-3">
					<div>
						<label className="mb-1 block text-xs text-neutral-200">Email</label>
						<input
							name="email"
							type="email"
							autoComplete="email"
							className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-xs text-neutral-50"
							required
							defaultValue={sp?.email as string | undefined}
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs text-neutral-200">Password</label>
						<input
							name="password"
							type="password"
							autoComplete="current-password"
							className="w-full rounded border border-white/15 bg-black/40 px-3 py-2 text-xs text-neutral-50"
							required
						/>
					</div>
					<button
						type="submit"
						className="mt-2 w-full rounded-full bg-neutral-50 px-3 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-200"
					>
						Sign in
					</button>
				</form>
				<div className="mt-4 text-center">
					<p className="text-[11px] text-neutral-400">
						Don't have an account?{" "}
						<a href="/auth/signup" className="text-emerald-400 hover:text-emerald-300 transition-colors">
							Sign up
						</a>
					</p>
				</div>
				<p className="mt-3 text-[11px] text-neutral-500">
					Your access level (Admin / POS only) is controlled by your staff role.
				</p>
			</div>
		</div>
	);
}






