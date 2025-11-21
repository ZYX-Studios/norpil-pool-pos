'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type StaffRole = "ADMIN" | "CASHIER" | "WAITER";

export async function updateStaffAction(formData: FormData) {
	const supabase = createSupabaseServerClient();

	const id = String(formData.get("id") || "").trim();
	const name = String(formData.get("name") || "").trim();
	const role = String(formData.get("role") || "CASHIER").toUpperCase() as StaffRole;

	if (!id) {
		throw new Error("Missing staff id");
	}
	if (!name) {
		throw new Error("Name is required");
	}
	if (!["ADMIN", "CASHIER", "WAITER"].includes(role)) {
		throw new Error("Invalid role");
	}

	const { error } = await supabase
		.from("staff")
		.update({
			name,
			role,
		})
		.eq("id", id);

	if (error) {
		throw error;
	}

	revalidatePath("/admin/staff");
	redirect("/admin/staff?ok=1");
}




