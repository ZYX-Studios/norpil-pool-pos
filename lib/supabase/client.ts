import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase instance for use in client components.
 * This should not be used in Server Components or Server Actions.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		// During `next build`, client modules can be evaluated while generating HTML.
		// We allow a placeholder client so builds/CI don't require secrets.
		// Runtime usage without real env vars should still fail fast.
		if (process.env.NEXT_PHASE === "phase-production-build") {
			console.warn(
				"[supabase] Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY during build; using placeholder values.",
			);
			return createBrowserClient("http://localhost", "placeholder");
		}

		throw new Error(
			"Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		);
	}

	return createBrowserClient(supabaseUrl, supabaseAnonKey);
}









