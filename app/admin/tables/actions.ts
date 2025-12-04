'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logger";

/**
 * Simple helpers for Admin Tables management.
 * All mutations revalidate and then redirect back to /admin/tables with a flag
 * so the page can show a subtle success message.
 */

function parseMoney(input: FormDataEntryValue | null, fallback = 0): number {
	if (input == null) return fallback;
	const n = Number(input);
	if (!Number.isFinite(n) || n < 0) return fallback;
	return Number(n.toFixed(2));
}

export async function createTableAction(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const name = String(formData.get("name") || "").trim();
	const rate = parseMoney(formData.get("hourly_rate"), 0);

	if (!name) {
		throw new Error("Table name is required");
	}

	const { error } = await supabase.from("pool_tables").insert({
		name,
		hourly_rate: rate,
		is_active: true,
	});
	if (error) throw error;

	revalidatePath("/admin/tables");

	await logAction({
		actionType: "CREATE_TABLE",
		entityType: "pool_table",
		details: { name, hourlyRate: rate },
	});

	redirect("/admin/tables?ok=1");
}

export async function updateTableAction(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const id = String(formData.get("id") || "").trim();
	const name = String(formData.get("name") || "").trim();
	const rate = parseMoney(formData.get("hourly_rate"), 0);

	if (!id) throw new Error("Missing table id");
	if (!name) throw new Error("Table name is required");

	const { error } = await supabase
		.from("pool_tables")
		.update({ name, hourly_rate: rate })
		.eq("id", id);
	if (error) throw error;

	revalidatePath("/admin/tables");

	await logAction({
		actionType: "UPDATE_TABLE",
		entityType: "pool_table",
		entityId: id,
		details: { name, hourlyRate: rate },
	});

	redirect("/admin/tables?ok=1");
}

export async function toggleTableActiveAction(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const id = String(formData.get("id") || "").trim();
	const current = String(formData.get("is_active") || "true") === "true";

	if (!id) throw new Error("Missing table id");

	const { error } = await supabase
		.from("pool_tables")
		.update({ is_active: !current })
		.eq("id", id);
	if (error) throw error;

	revalidatePath("/admin/tables");

	await logAction({
		actionType: "TOGGLE_TABLE_ACTIVE",
		entityType: "pool_table",
		entityId: id,
		details: { isActive: !current },
	});

	redirect("/admin/tables?ok=1");
}





export async function deleteTableAction(id: string) {
	const supabase = createSupabaseServerClient();

	if (!id) return { error: "Missing table id" };

	const { error } = await supabase
		.from("pool_tables")
		.update({ deleted_at: new Date().toISOString() })
		.eq("id", id);

	if (error) {
		console.error("Error deleting table:", error);
		return { error: "Failed to delete table" };
	}

	revalidatePath("/admin/tables");

	await logAction({
		actionType: "DELETE_TABLE",
		entityType: "pool_table",
		entityId: id,
		details: {},
	});

	redirect("/admin/tables?ok=1");
}
