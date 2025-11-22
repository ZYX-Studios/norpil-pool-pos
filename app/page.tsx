import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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
	// We use the server-side Supabase client so we can inspect the auth cookie
	// on the initial request. This is the recommended pattern for @supabase/ssr.
	const supabase = createSupabaseServerClient();

	// Ask Supabase for the current auth user based on the request cookies.
	const { data, error } = await supabase.auth.getUser();

	// If we have a valid user and no auth error, go directly to the POS shell.
	if (!error && data.user) {
		redirect("/pos");
	}

	// Otherwise, send the person to the login form so they can authenticate.
	redirect("/auth/login");
}

