'use server'

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
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

	revalidatePath("/", "layout");

	if (staff?.role === "ADMIN") {
		redirect("/admin");
	} else if (staff) {
		redirect("/pos");
	}

	// If not staff, assume customer
	redirect("/mobile/home");
}

export async function logoutAction() {
	const supabase = createSupabaseServerActionClient();
	await supabase.auth.signOut();
	revalidatePath("/", "layout");
	redirect("/auth/login");
}

export async function signupAction(formData: FormData) {
	const email = String(formData.get("email") || "").trim();
	const password = String(formData.get("password") || "");
	const fullName = String(formData.get("fullName") || "").trim();
	const ranking = String(formData.get("ranking") || "");

	if (!email || !password || !fullName) {
		redirect("/auth/signup?error=missing");
	}

	const supabase = createSupabaseServerActionClient();

	const { data, error } = await supabase.auth.signUp({
		email,
		password,
		options: {
			data: {
				full_name: fullName,
				ranking: ranking,
			},
		},
	});

	if (error) {
		console.error("Signup error:", error);
		redirect(`/auth/signup?error=${encodeURIComponent(error.message)}`);
	}

	if (data.session) {
		// User is logged in immediately (email confirmation disabled or not required)
		redirect("/mobile/home");
	} else {
		// Email confirmation required
		redirect("/auth/verify-email");
	}
}

export async function forgotPasswordAction(formData: FormData) {
	const email = String(formData.get("email") || "").trim();
	const supabase = createSupabaseServerActionClient();
	const origin = (await headers()).get("origin");

	if (!email) {
		redirect("/auth/forgot-password?error=missing");
	}

	const { error } = await supabase.auth.resetPasswordForEmail(email, {
		redirectTo: `${origin}/auth/callback?next=/auth/update-password`,
	});

	if (error) {
		console.error("Forgot password error:", error);
		redirect("/auth/forgot-password?error=invalid");
	}

	redirect("/auth/forgot-password?success=true");
}

export async function updatePasswordAction(formData: FormData) {
	const password = String(formData.get("password") || "");
	const confirmPassword = String(formData.get("confirmPassword") || "");

	if (!password || !confirmPassword) {
		redirect("/auth/update-password?error=missing");
	}

	if (password !== confirmPassword) {
		redirect("/auth/update-password?error=match");
	}

	const supabase = createSupabaseServerActionClient();
	const { error } = await supabase.auth.updateUser({ password });

	if (error) {
		console.error("Update password error:", error);
		redirect("/auth/update-password?error=update-failed");
	}

	redirect("/auth/login?success=password-updated");
}



