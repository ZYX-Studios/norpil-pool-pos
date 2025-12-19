'use server';

'use server';

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function promoteUserAction(prevState: any, formData: FormData) {
	const email = String(formData.get("email"));
	const role = String(formData.get("role")) as "CASHIER" | "WAITER" | "ADMIN" | "OWNER";

	const supabase = createSupabaseServerActionClient();

	// 1. Check if current user is Admin
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return { error: "Unauthorized", message: "" };

	const { data: currentUserStaff } = await supabase
		.from("staff")
		.select("role")
		.eq("user_id", user.id)
		.single();

	if (currentUserStaff?.role !== "ADMIN" && currentUserStaff?.role !== "OWNER") {
		return { error: "Only admins can promote users.", message: "" };
	}

	// 2. Lookup User ID by Email
	const { data: targetUserId, error: lookupError } = await supabase
		.rpc("get_user_id_by_email", { p_email: email });

	if (lookupError || !targetUserId) {
		return { error: "User not found. Please ensure they have signed up first.", message: "" };
	}

	// 3. Check if already staff
	const { data: existingStaff } = await supabase
		.from("staff")
		.select("id")
		.eq("user_id", targetUserId)
		.single();

	if (existingStaff) {
		return { error: "User is already a staff member.", message: "" };
	}

	// 4. Insert into Staff
	const { error: insertError } = await supabase
		.from("staff")
		.insert({
			user_id: targetUserId,
			name: email, // Default name
			role: role
		});

	if (insertError) {
		console.error("Promotion error:", insertError);
		return { error: "Failed to promote user.", message: "" };
	}

	revalidatePath("/admin/staff");
	return { message: "User promoted successfully!", error: "" };
}

export async function deleteStaffAction(formData: FormData) {
	const id = String(formData.get("id"));
	const supabase = createSupabaseServerActionClient();

	// Check if current user is Admin
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	const { data: currentUserStaff } = await supabase
		.from("staff")
		.select("role")
		.eq("user_id", user.id)
		.single();

	if (currentUserStaff?.role !== "ADMIN" && currentUserStaff?.role !== "OWNER") {
		return;
	}

	console.log("Attempting to delete staff:", id);

	const { error } = await supabase
		.from("staff")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);

	if (error) {
		console.error("Delete staff error:", error);
	} else {
		console.log("Staff deleted successfully:", id);
	}

	revalidatePath("/admin/staff");
}

export async function updateStaffAction(formData: FormData) {
	const supabase = createSupabaseServerActionClient();
	const id = String(formData.get("id"));
	const name = String(formData.get("name"));
	const role = String(formData.get("role"));

	// Check if current user is Admin
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return;

	const { data: currentUserStaff } = await supabase
		.from("staff")
		.select("role")
		.eq("user_id", user.id)
		.single();

	if (currentUserStaff?.role !== "ADMIN" && currentUserStaff?.role !== "OWNER") {
		return;
	}

	await supabase
		.from("staff")
		.update({ name, role: role as any })
		.eq("id", id);

	revalidatePath("/admin/staff");
	revalidatePath("/admin/staff?ok=true");
}
