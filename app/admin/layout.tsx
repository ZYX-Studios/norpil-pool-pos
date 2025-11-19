import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { logoutAction } from "../auth/actions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const { user, staff } = await getCurrentUserWithStaff();
	if (!user) {
		redirect("/auth/login");
	}
	if (staff?.role !== "ADMIN") {
		redirect("/pos");
	}

	return (
		<div className="min-h-screen bg-gradient-to-br from-neutral-950 via-neutral-900 to-black text-neutral-50">
			<div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-4">
				<header className="mb-4 flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm shadow-black/50 backdrop-blur">
					<div>
						<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">Norpil Billiards</div>
						<div className="text-sm font-semibold text-neutral-50">Admin · Back Office</div>
					</div>
					{/* 
						Simple responsive nav: allow links to wrap on small screens.
						This keeps the header usable on narrow mobile widths without complex menus.
					*/}
					<nav className="flex flex-wrap items-center gap-2 text-xs text-neutral-300">
						<span className="hidden sm:inline text-neutral-400">
							{staff?.name} · {staff?.role}
						</span>
						<Link href="/admin" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Overview
						</Link>
						<Link href="/admin/tables" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Tables
						</Link>
						<Link href="/admin/products" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Products
						</Link>
						<Link href="/admin/inventory" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Inventory
						</Link>
						<Link href="/admin/reports" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Reports
						</Link>
						<Link href="/admin/staff" className="rounded-full px-3 py-1 hover:bg-white/10 hover:text-white">
							Staff
						</Link>
						<div className="mx-1 h-4 w-px bg-white/20" />
						<Link
							href="/pos"
							className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-medium hover:bg-white/15 hover:text-white"
						>
							POS
						</Link>
						<form action={logoutAction}>
							<button
								type="submit"
								className="rounded-full border border-white/10 bg-black/40 px-3 py-1 font-medium text-neutral-200 hover:bg-black/70 hover:text-white"
							>
								Sign out
							</button>
						</form>
					</nav>
				</header>
				<main className="flex-1 rounded-2xl border border-white/10 bg-neutral-950/60 p-6 shadow-inner shadow-black/60">
					{children}
				</main>
			</div>
		</div>
	);
}

