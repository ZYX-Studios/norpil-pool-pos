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
			// Most likely a connectivity issue or invalid session cookie.
			console.error("Failed to fetch Supabase auth user", userErr);
			return { user: null, staff: null, authError: "supabase_unreachable" };
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

		// Auto-provision staff on first login
		const role: StaffRow["role"] = user.email === "robneil@gmail.com" ? "ADMIN" : "CASHIER";
		const name = user.email ?? "Staff";

		const { data: inserted, error: insertErr } = await supabase
			.from("staff")
			.insert({
				user_id: user.id,
				name,
				role,
			})
			.select("id, user_id, name, role")
			.single();

		if (insertErr || !inserted) {
			console.error("Failed to auto-provision staff row", insertErr);
			return { user, staff: null, authError: null };
		}

		return { user, staff: inserted as StaffRow, authError: null };
	} catch (error) {
		// Any unexpected error here should be treated as "auth service unreachable".
		console.error("getCurrentUserWithStaff failed", error);
		return { user: null, staff: null, authError: "supabase_unreachable" };
	}
}



