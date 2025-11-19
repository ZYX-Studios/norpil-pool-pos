import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { logoutAction } from "../auth/actions";
import { PosSyncStatus } from "./PosSyncStatus";

export default async function PosLayout({ children }: { children: React.ReactNode }) {
	const { user, staff, authError } = await getCurrentUserWithStaff();

	// If Supabase auth is reachable and there is no user, we treat this as a normal
	// unauthenticated state and send the person to login.
	if (!user && authError !== "supabase_unreachable") {
		redirect("/auth/login");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-neutral-50">
			<div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4">
				<header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/50 backdrop-blur">
					<div>
						<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Norpil Billiards</div>
						<div className="text-sm font-semibold text-neutral-50">POS · Tables</div>
					</div>
					{/* 
						Keep POS header controls readable on phones by allowing buttons to wrap.
						This is a simple mobile-friendly adjustment without adding a complex menu.
					*/}
					<div className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
						<span className="hidden sm:inline text-neutral-400">
							{staff?.name ?? (authError === "supabase_unreachable" ? "Offline" : "Guest")} ·{" "}
							{staff?.role ?? "STAFF"}
						</span>
						{/* 
							Show a small connectivity + sync indicator for the POS.
							This both triggers background syncs and reassures staff
							that offline mode is working as expected.
						*/}
						<PosSyncStatus />
						<Link
							href="/admin"
							className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium hover:bg-white/10 hover:text-white"
						>
							Admin
						</Link>
						<form action={logoutAction}>
							<button
								type="submit"
								className="rounded-full border border-white/10 bg-black/40 px-3 py-1 font-medium text-neutral-200 hover:bg-black/70 hover:text-white"
							>
								Sign out
							</button>
						</form>
					</div>
				</header>
				<main className="flex-1 rounded-2xl border border-white/10 bg-neutral-950/60 p-4 shadow-inner shadow-black/60">
					{children}
				</main>
			</div>
		</div>
	);
}
