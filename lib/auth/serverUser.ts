import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type StaffRow = {
	id: string;
	user_id: string;
	name: string;
	role: "ADMIN" | "CASHIER" | "WAITER";
};

/**
 * Fetches the current Supabase auth user and associated staff row.
 * If a staff row does not exist yet, it auto-creates one:
 * - robneil@gmail.com → ADMIN
 * - everyone else → CASHIER
 *
 * When Supabase is unreachable (for example, the device is offline), this
 * function returns { user: null, staff: null, authError: "supabase_unreachable" }
 * so callers can choose a safe fallback instead of redirecting to login.
 */
export async function getCurrentUserWithStaff(): Promise<{
	user: User | null;
	staff: StaffRow | null;
	authError: string | null;
}> {
	try {
		const supabase = createSupabaseServerClient();

		const { data, error: userErr } = await supabase.auth.getUser();

		if (userErr) {
			// Suppress "Auth session missing!" error which is expected for unauthenticated requests (e.g. PDF generation)
			// and doesn't indicate a system failure.
			const isSessionMissing = userErr.name === "AuthSessionMissingError" ||
				(userErr as any).code === "PGRST301" || // JWT expired/missing
				userErr.message.includes("Auth session missing");

			if (!isSessionMissing) {
				console.error("Failed to fetch Supabase auth user", userErr);
			}

			return { user: null, staff: null, authError: isSessionMissing ? null : "supabase_unreachable" };
		}

		const user = data.user;
		if (!user) {
			return { user: null, staff: null, authError: null };
		}

		// Try existing staff row first
		const { data: existing, error: existingErr } = await supabase
			.from("staff")
			.select("id, user_id, name, role")
			.eq("user_id", user.id)
			.maybeSingle();

		if (!existingErr && existing) {
			return { user, staff: existing as StaffRow, authError: null };
		}

		// If no staff row exists, they are a customer.
		return { user, staff: null, authError: null };
	} catch (error) {
		// Any unexpected error here should be treated as "auth service unreachable".
		console.error("getCurrentUserWithStaff failed", error);
		return { user: null, staff: null, authError: "supabase_unreachable" };
	}
}



