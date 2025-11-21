'use server';

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Simple server action for recording an operating expense.
 *
 * We keep validation intentionally straightforward and rely on the
 * expense_category enum in the database to guard invalid categories.
 */
export async function createExpense(formData: FormData) {
	const supabase = createSupabaseServerActionClient();

	// Basic field extraction from the posted form.
	const rawDate = formData.get("expense_date");
	const rawCategory = formData.get("category");
	const rawAmount = formData.get("amount");
	const rawNote = formData.get("note");

	const expenseDate = typeof rawDate === "string" && rawDate.length > 0 ? rawDate : null;
	const category = typeof rawCategory === "string" && rawCategory.length > 0 ? rawCategory : null;
	const amount = typeof rawAmount === "string" ? Number(rawAmount) : NaN;
	const note =
		typeof rawNote === "string" && rawNote.trim().length > 0 ? rawNote.trim() : null;

	// If the payload is clearly invalid, we skip the insert.
	// The UI stays simple and any validation issues can be tightened later.
	if (!expenseDate || !category || !Number.isFinite(amount) || amount <= 0) {
		return;
	}

	const { error } = await supabase.from("expenses").insert({
		expense_date: expenseDate,
		category,
		amount,
		note,
	});

	if (error) {
		// For now we just log; this keeps the UI unaware of internal error details.
		// In a later iteration we can surface a friendlier message.
		console.error("Failed to create expense:", error);
	}

	// Revalidate the reports page so the new expense immediately appears
	// in totals and the expense list.
	await revalidatePath("/admin/reports");
}



