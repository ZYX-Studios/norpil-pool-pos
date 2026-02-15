import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Internal helper to read Supabase env vars with a clear error if missing.
 */
function getSupabaseEnv() {
	// Fallback values for build time to prevent crashes during static generation
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error(
			"Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		);
	}

	return { supabaseUrl, supabaseAnonKey };
}

/**
 * Server-side Supabase client for Server Components and regular data fetching.
 *
 * Uses getAll/setAll as recommended by @supabase/ssr.
 * In Server Components, setAll may throw when trying to modify cookies;
 * we catch and ignore that case. Session refresh can still be handled
 * by Server Actions or middleware.
 */
export function createSupabaseServerClient(): SupabaseClient {
	const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll: async () => {
				const cookieStore = await cookies();
				return cookieStore.getAll();
			},
			setAll: async (cookiesToSet) => {
				try {
					const cookieStore = await cookies();
					cookiesToSet.forEach(({ name, value, options }) => {
						cookieStore.set(name, value, options);
					});
				} catch {
					// Called from a context where cookie mutation is not allowed (e.g. Server Component).
					// This is safe to ignore because Server Actions / middleware handle session refresh.
				}
			},
		},
	});
}

/**
 * Supabase client for Server Actions / Route Handlers where cookie writes are allowed.
 *
 * Uses getAll/setAll without try/catch so Supabase can freely update auth cookies.
 * Use this ONLY in files marked with 'use server' (Server Actions) or Route Handlers.
 */
export function createSupabaseServerActionClient(): SupabaseClient {
	const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();

	return createServerClient(supabaseUrl, supabaseAnonKey, {
		cookies: {
			getAll: async () => {
				const cookieStore = await cookies();
				return cookieStore.getAll();
			},
			setAll: async (cookiesToSet) => {
				const cookieStore = await cookies();
				cookiesToSet.forEach(({ name, value, options }) => {
					cookieStore.set(name, value, options);
				});
			},
		},
	});
}


