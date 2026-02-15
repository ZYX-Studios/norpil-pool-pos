import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Client-side Supabase instance for use in client components.
 * This should not be used in Server Components or Server Actions.
 */
export function createSupabaseBrowserClient(): SupabaseClient {
	const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
	const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key";

	if (!supabaseUrl || !supabaseAnonKey) {
		// This check is effectively redundant with the defaults, 
		// but kept for clarity if defaults are removed.
		throw new Error(
			"Missing Supabase env vars. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
		);
	}

	return createBrowserClient(supabaseUrl, supabaseAnonKey);
}









