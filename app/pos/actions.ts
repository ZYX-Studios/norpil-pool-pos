'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function openTableAction(poolTableId: string) {
	const supabase = createSupabaseServerClient();

	try {
		// Find an existing OPEN session for this table (idempotency safeguard)
		const { data: existing, error: existingErr } = await supabase
			.from("table_sessions")
			.select("id, status")
			.eq("pool_table_id", poolTableId)
			.eq("status", "OPEN")
			.limit(1)
			.maybeSingle();

		if (existingErr) {
			throw existingErr;
		}
		if (existing?.id) {
			redirect(`/pos/${existing.id}`);
		}

		// Create session
		const { data: session, error: sessionErr } = await supabase
			.from("table_sessions")
			.insert({
				pool_table_id: poolTableId,
				status: "OPEN",
			})
			.select("id")
			.single();

		if (sessionErr || !session) {
			throw sessionErr ?? new Error("Failed to create table session.");
		}

		// Create an OPEN order for this session
		const { error: orderErr } = await supabase.from("orders").insert({
			table_session_id: session.id,
			status: "OPEN",
		});
		if (orderErr) {
			throw orderErr;
		}

		revalidatePath("/pos");
		redirect(`/pos/${session.id}`);
	} catch (error) {
		// If this is a Next.js redirect error, rethrow so navigation works.
		// Redirects are implemented as throws with a special digest; treating
		// them as real failures would break the normal "redirect to session"
		// flow when opening a table online.
		if (error && typeof error === "object" && "digest" in error && typeof (error as any).digest === "string") {
			throw error;
		}

		// When offline or when Supabase is unreachable, we land here instead of
		// crashing the server action. We redirect back to the POS home with a
		// simple error code so the UI can show a friendly message.
		console.error("openTableAction failed", error);
		redirect("/pos?error=open_table");
	}
}


