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
 */
export async function getCurrentUserWithStaff(): Promise<{
	user: User | null;
	staff: StaffRow | null;
}> {
	const supabase = createSupabaseServerClient();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { user: null, staff: null };
	}

	// Try existing staff row first
	const { data: existing, error: existingErr } = await supabase
		.from("staff")
		.select("id, user_id, name, role")
		.eq("user_id", user.id)
		.maybeSingle();

	if (!existingErr && existing) {
		return { user, staff: existing as StaffRow };
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
		return { user, staff: null };
	}

	return { user, staff: inserted as StaffRow };
}



