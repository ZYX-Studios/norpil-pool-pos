import { redirect } from "next/navigation";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { AdminHeader } from "./components/AdminHeader";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
	const { user, staff, authError } = await getCurrentUserWithStaff();

	// If auth is unreachable or the user is missing, force re-auth when online.
	// Admin is intentionally kept online-only to keep permissions simple.
	if (!user || authError === "supabase_unreachable") {
		redirect("/auth/login");
	}
	if (staff?.role !== "ADMIN") {
		redirect("/pos");
	}

	return (
		<div className="min-h-screen bg-black text-neutral-50 selection:bg-indigo-500/30">
			{/* Ambient Background */}
			<div className="fixed inset-0 z-0 pointer-events-none">
				<div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/5 blur-[120px]" />
				<div className="absolute top-[20%] right-[-5%] w-[30%] h-[30%] rounded-full bg-violet-500/5 blur-[100px]" />
			</div>

			<div className="relative z-10 mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 md:px-6 md:py-8">
				<AdminHeader staff={staff} />
				<main className="flex-1 animate-in fade-in slide-in-from-bottom-4 duration-500">
					{children}
				</main>
			</div>
		</div>
	);
}

