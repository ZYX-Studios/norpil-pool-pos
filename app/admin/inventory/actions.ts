'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Keep types narrow so intent stays clear.
type MovementType = "INITIAL" | "PURCHASE" | "SALE" | "ADJUSTMENT";
type InventoryUnit = "PCS" | "BOTTLE" | "CAN" | "ML" | "L" | "GRAM" | "KG";

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
		.update({ name, sku: sku || null, unit, is_active: isActive })
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

	const { error } = await supabase.from("inventory_movements").insert({
		inventory_item_id: inventoryItemId,
		movement_type: movementType,
		quantity: delta,
		note,
	});
	if (error) throw error;

	revalidatePath("/admin/inventory");
	redirect("/admin/inventory?ok=1");
}


