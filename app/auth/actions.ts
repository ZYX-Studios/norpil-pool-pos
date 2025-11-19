'use server'

import { redirect } from "next/navigation";
import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";

export async function loginAction(formData: FormData) {
	const email = String(formData.get("email") || "").trim();
	const password = String(formData.get("password") || "");

	if (!email || !password) {
		redirect("/auth/login?error=missing");
	}

	const supabase = createSupabaseServerActionClient();
	const { data, error } = await supabase.auth.signInWithPassword({ email, password });

	if (error || !data.user) {
		redirect("/auth/login?error=invalid");
	}

	// Ensure staff row exists and determine role
	const { staff } = await getCurrentUserWithStaff();

	if (staff?.role === "ADMIN") {
		redirect("/admin");
	}

	redirect("/pos");
}

export async function logoutAction() {
	const supabase = createSupabaseServerActionClient();
	await supabase.auth.signOut();
	redirect("/auth/login");
}



