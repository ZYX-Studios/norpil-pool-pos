import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Logo } from "@/app/components/ui/Logo";

/**
 * Root page for the app.
 *
 * - If there is a logged-in Supabase user we send them straight to the POS.
 * - If not logged in (or the session is missing) we send them to the login screen.
 *
 * This keeps the landing experience simple. Staff do not see a blank / marketing
 * page – they always end up either at /auth/login or /pos.
 */
export default async function Home() {
	const supabase = createSupabaseServerClient();

	const { data: { user }, error } = await supabase.auth.getUser();

	if (!error && user) {
		// Check if the user is a staff member
		const { data: staff } = await supabase
			.from("staff")
			.select("role")
			.eq("user_id", user.id)
			.single();

		if (staff) {
			if (staff.role === "OWNER") {
				redirect("/owner");
			}
			redirect("/pos");
		}
	}

	// If not logged in, show the Landing Page
	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 p-6 text-center">
			<div className="space-y-8 max-w-sm w-full">
				<div className="space-y-4">
					<Logo className="mx-auto h-32 w-auto text-white" />
					<h1 className="mt-6 text-4xl font-bold tracking-tight text-neutral-50">NORPIL BILLIARDS</h1>
					<p className="text-lg text-neutral-400">Experience premium billiards, seamless ordering, and exclusive rewards.</p>
				</div>

				<div className="space-y-3">
					<a
						href="/auth/login"
						className="block w-full rounded-xl bg-emerald-500 py-3.5 font-semibold text-white shadow-lg shadow-emerald-500/20 transition-all hover:bg-emerald-400 active:scale-[0.98]"
					>
						Sign In
					</a>
					<a
						href="/auth/signup"
						className="block w-full rounded-xl border border-white/10 bg-white/5 py-3.5 font-semibold text-neutral-50 backdrop-blur transition-all hover:bg-white/10 active:scale-[0.98]"
					>
						Create Account
					</a>
				</div>

				<div className="pt-8 text-sm text-neutral-500">
					<p>Open daily from 10:00 AM - 3:00 AM</p>
				</div>
			</div>
		</div>
	);
}

