'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Keep types narrow so intent stays clear.
type MovementType = "INITIAL" | "PURCHASE" | "SALE" | "ADJUSTMENT";
type InventoryUnit = "PCS" | "BOTTLE" | "CAN" | "ML" | "L" | "GRAM" | "KG";

// Helper to parse a decimal number from a form field.
// We clamp to 2 decimal places because inventory_items.unit_cost is numeric(10,2)
// in the database. This keeps form handling predictable and safe.
function parseNumber(input: FormDataEntryValue | null, fallback = 0): number {
	if (input == null) return fallback;
	const raw = String(input).trim();
	if (!raw) return fallback;
	const n = Number(raw);
	if (!Number.isFinite(n)) return fallback;
	return Number(n.toFixed(2));
}

function parseIntQuantity(input: FormDataEntryValue | null): number {
	if (input == null) return 0;
	const raw = String(input).trim();
	if (!raw) return 0;
	const n = Number(raw);
	if (!Number.isFinite(n) || n === 0) return 0;
	// Whole-unit quantities only for now.
	return n > 0 ? Math.floor(n) : Math.ceil(n);
}

// Simple SKU generator when the user leaves SKU blank.
// We base it on the name (uppercased, alphanumeric and dashes only).
function generateSkuFromName(name: string): string | null {
	const base = name
		.trim()
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return base || null;
}

export async function createInventoryItem(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const name = String(formData.get("name") || "").trim();
	let sku = String(formData.get("sku") || "").trim();
	const unitRaw = String(formData.get("unit") || "PCS").trim().toUpperCase() || "PCS";
	const allowedUnits: InventoryUnit[] = ["PCS", "BOTTLE", "CAN", "ML", "L", "GRAM", "KG"];
	const unit: InventoryUnit = (allowedUnits.includes(unitRaw as InventoryUnit) ? unitRaw : "PCS") as InventoryUnit;
	const unitCost = Math.max(parseNumber(formData.get("unit_cost"), 0), 0);

	if (!name) {
		throw new Error("Name is required");
	}

	// Auto-generate a SKU if left blank so inventory stays easy to reference.
	if (!sku) {
		const auto = generateSkuFromName(name);
		if (auto) {
			sku = auto;
		}
	}

	const { error } = await supabase.from("inventory_items").insert({
		name,
		sku: sku || null,
		unit,
		// We always persist a non-negative cost so reporting functions
		// can safely treat unit_cost as a simple numeric(10,2) value.
		unit_cost: unitCost,
		is_active: true,
	});
	if (error) {
		// 23505 = unique_violation, likely duplicate SKU on inventory_items.sku.
		// We treat this as a validation error and redirect with a query flag
		// instead of crashing the page.
		if ((error as any).code === "23505") {
			revalidatePath("/admin/inventory");
			redirect("/admin/inventory?error=sku");
		}
		throw error;
	}

	revalidatePath("/admin/inventory");
	redirect("/admin/inventory?ok=1");
}

export async function updateInventoryItem(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const id = String(formData.get("id") || "").trim();
	const name = String(formData.get("name") || "").trim();
	let sku = String(formData.get("sku") || "").trim();
	const unitRaw = String(formData.get("unit") || "PCS").trim().toUpperCase() || "PCS";
	const allowedUnits: InventoryUnit[] = ["PCS", "BOTTLE", "CAN", "ML", "L", "GRAM", "KG"];
	const unit: InventoryUnit = (allowedUnits.includes(unitRaw as InventoryUnit) ? unitRaw : "PCS") as InventoryUnit;
	const isActiveRaw = String(formData.get("is_active") || "true");
	const isActive = isActiveRaw === "true";
	const unitCost = Math.max(parseNumber(formData.get("unit_cost"), 0), 0);

	if (!id) throw new Error("Missing id");
	if (!name) throw new Error("Name is required");

	// If SKU is cleared out, regenerate a simple one based on the name.
	if (!sku) {
		const auto = generateSkuFromName(name);
		if (auto) {
			sku = auto;
		}
	}

	const { error } = await supabase
		.from("inventory_items")
		.update({ name, sku: sku || null, unit, is_active: isActive, unit_cost: unitCost })
		.eq("id", id);
	if (error) throw error;

	revalidatePath("/admin/inventory");
	redirect("/admin/inventory?ok=1");
}

export async function adjustInventoryItem(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const inventoryItemId = String(formData.get("inventoryItemId") || "").trim();
	const delta = parseIntQuantity(formData.get("delta"));
	const movementType = String(formData.get("movement_type") || "ADJUSTMENT").toUpperCase() as MovementType;
	const noteRaw = String(formData.get("note") || "").trim();
	const note = noteRaw.length > 0 ? noteRaw : null;

	if (!inventoryItemId) {
		throw new Error("Missing inventory item id");
	}
	if (delta === 0) {
		// Treat this as a validation error and redirect with a flag instead of throwing.
		revalidatePath("/admin/inventory");
		redirect("/admin/inventory?error=delta");
	}
	if (!["INITIAL", "PURCHASE", "SALE", "ADJUSTMENT"].includes(movementType)) {
		throw new Error("Invalid movement type");
	}

	// 1) Always record the stock movement so on-hand quantities stay correct.
	const { error } = await supabase.from("inventory_movements").insert({
		inventory_item_id: inventoryItemId,
		movement_type: movementType,
		quantity: delta,
		note,
	});
	if (error) throw error;

	// 2) If this is a PURCHASE with a positive quantity, also record an expense.
	// We keep this simple and cash-based:
	// - Use the current inventory_items.unit_cost as the per-unit price.
	// - Multiply by the purchased quantity to get the expense amount.
	// - Save it under the INVENTORY expense category so it flows into reports.
	if (movementType === "PURCHASE" && delta > 0) {
		const { data: item, error: itemError } = await supabase
			.from("inventory_items")
			.select("name, unit_cost")
			.eq("id", inventoryItemId)
			.maybeSingle();

		if (!itemError && item) {
			const unitCost = Number((item as any).unit_cost ?? 0);
			const purchaseAmount = Number.isFinite(unitCost) ? Number((unitCost * delta).toFixed(2)) : 0;

			if (purchaseAmount > 0) {
				// Use today's date for the expense so it lines up with when stock was added.
				const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
				const baseNote = `Inventory purchase - ${String((item as any).name ?? "").trim() || "Unknown item"}`;
				const combinedNote = note ? `${baseNote} / ${note}` : baseNote;

				await supabase.from("expenses").insert({
					expense_date: today,
					category: "INVENTORY",
					amount: purchaseAmount,
					note: combinedNote,
				});
			}
		}
	}

	revalidatePath("/admin/inventory");
	redirect("/admin/inventory?ok=1");
}




export async function deleteInventoryItemAction(id: string) {
	const supabase = createSupabaseServerClient();

	// Safety check: is this item used in any recipes?
	const { count, error: countError } = await supabase
		.from("product_inventory_recipes")
		.select("*", { count: "exact", head: true })
		.eq("inventory_item_id", id);

	if (countError) throw countError;

	if (count && count > 0) {
		// Block deletion if used in recipes.
		return { error: "Cannot delete this item because it is used in product recipes." };
	}

	// Safe to delete.
	try {
		const { error, count } = await supabase.from("inventory_items").delete({ count: "exact" }).eq("id", id);
		if (error) throw error;
		if (count === 0) {
			return { error: `Item not found or permission denied. ID: ${id}` };
		}
	} catch (error: any) {
		return { error: error.message || "Unknown error" };
	}

	revalidatePath("/admin/inventory");
	return { success: true };
}
