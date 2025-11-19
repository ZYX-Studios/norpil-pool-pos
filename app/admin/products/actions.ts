'use server'

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Keep types small and explicit so form handling stays easy to read.
type Category = "FOOD" | "DRINK" | "OTHER" | "TABLE_TIME";
type MovementType = "INITIAL" | "PURCHASE" | "SALE" | "ADJUSTMENT";

function parseNumber(input: FormDataEntryValue | null, fallback = 0): number {
	if (input == null) return fallback;
	const n = Number(input);
	return Number.isFinite(n) ? Number(n.toFixed(2)) : fallback;
}

// Simple helper to parse an integer quantity for inventory movements.
function parseIntQuantity(input: FormDataEntryValue | null): number {
	if (input == null) return 0;
	const n = Number(String(input).trim());
	if (!Number.isFinite(n) || n === 0) return 0;
	// We only allow whole units in this POS, so round toward zero.
	return n > 0 ? Math.floor(n) : Math.ceil(n);
}

// Helper for recipe quantities: allow up to 4 decimal places so we can model
// partial units (e.g. 0.25 of a bottle or 0.1 kg).
// If the field is left blank, we default to 1 for a smoother UX.
function parseRecipeQuantity(input: FormDataEntryValue | null): number {
	const raw = String(input ?? "").trim();
	if (!raw) return 1;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Number(Number(n).toFixed(4));
}

export async function createProduct(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const name = String(formData.get("name") || "").trim();
	const sku = String(formData.get("sku") || "").trim() || null;
	const category = String(formData.get("category") || "OTHER") as Category;
	const price = parseNumber(formData.get("price"));
	const taxRate = parseNumber(formData.get("tax_rate"), 0.12);

	if (!name) throw new Error("Name is required");
	if (!["FOOD", "DRINK", "OTHER", "TABLE_TIME"].includes(category)) {
		throw new Error("Invalid category");
	}

	const { error } = await supabase.from("products").insert({
		name,
		sku,
		category,
		price,
		tax_rate: taxRate,
		is_active: true,
	});
	if (error) throw error;

	// For simple setups we keep a 1:1 mapping between products and inventory_items by SKU.
	// A later admin screen can manage more complex recipes.
	if (sku) {
		const { data: inventoryItem, error: invErr } = await supabase
			.from("inventory_items")
			.select("id")
			.eq("sku", sku)
			.maybeSingle();
		if (!invErr && !inventoryItem) {
			const { data: newItem, error: createInvErr } = await supabase
				.from("inventory_items")
				.insert({
					name,
					sku,
					unit: "PCS",
					is_active: true,
				})
				.select("id")
				.single();
			if (!createInvErr && newItem?.id) {
				// Link product to its inventory item with a 1:1 recipe.
				await supabase.from("product_inventory_recipes").insert({
					product_id: (await supabase.from("products").select("id").eq("sku", sku).order("created_at", { ascending: false }).limit(1).maybeSingle()).data?.id,
					inventory_item_id: newItem.id,
					quantity: 1,
				});
			}
		}
	}

	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

export async function updateProduct(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const id = String(formData.get("id") || "");
	const name = String(formData.get("name") || "").trim();
	const sku = String(formData.get("sku") || "").trim() || null;
	const category = String(formData.get("category") || "OTHER") as Category;
	const price = parseNumber(formData.get("price"));
	const taxRate = parseNumber(formData.get("tax_rate"), 0.12);

	if (!id) throw new Error("Missing id");
	if (!name) throw new Error("Name is required");
	if (!["FOOD", "DRINK", "OTHER", "TABLE_TIME"].includes(category)) {
		throw new Error("Invalid category");
	}

	const { error } = await supabase
		.from("products")
		.update({ name, sku, category, price, tax_rate: taxRate })
		.eq("id", id);
	if (error) throw error;
	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

export async function toggleActiveAction(id: string, isActive: boolean) {
	const supabase = createSupabaseServerClient();
	const { error } = await supabase.from("products").update({ is_active: !isActive }).eq("id", id);
	if (error) throw error;
	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

export async function deleteProductAction(id: string) {
	const supabase = createSupabaseServerClient();
	// Will fail if referenced by order_items (FK). That's fine; surface message.
	const { error } = await supabase.from("products").delete().eq("id", id);
	if (error) throw error;
	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

export async function createManyProducts(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const raw = String(formData.get("lines") || "");
	const rows = raw
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter(Boolean);
	if (rows.length === 0) {
		redirect("/admin/products?ok=1");
	}
	const records: Array<{ name: string; sku: string | null; category: string; price: number; tax_rate: number; is_active: boolean }> = [];
	for (const line of rows) {
		// format: name,sku(optional),category,price,tax_rate(optional)
		const parts = line.split(",").map((p) => p.trim());
		const [name, skuMaybe, categoryRaw, priceRaw, taxRaw] = parts;
		const nameVal = name ?? "";
		const categoryVal = (categoryRaw ?? "OTHER").toUpperCase();
		const priceVal = Number(priceRaw ?? "0");
		const taxVal = Number(taxRaw ?? "0.12");
		if (!nameVal) continue;
		if (!["FOOD", "DRINK", "OTHER", "TABLE_TIME"].includes(categoryVal)) continue;
		if (!Number.isFinite(priceVal)) continue;
		records.push({
			name: nameVal,
			sku: skuMaybe ? skuMaybe : null,
			category: categoryVal,
			price: Number(priceVal.toFixed(2)),
			tax_rate: Number(isNaN(taxVal) ? 0.12 : Number(taxVal.toFixed(2))),
			is_active: true,
		});
	}
	if (records.length > 0) {
		const { error } = await supabase.from("products").insert(records);
		if (error) throw error;
	}
	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

// Adjust inventory for a single product by writing a movement row.
// Under the hood we resolve the main inventory item via the 1:1 recipe mapping.
export async function adjustInventory(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const productId = String(formData.get("productId") || "").trim();
	const delta = parseIntQuantity(formData.get("delta"));
	const movementType = String(formData.get("movement_type") || "ADJUSTMENT").toUpperCase() as MovementType;
	const noteRaw = String(formData.get("note") || "").trim();
	const note = noteRaw.length > 0 ? noteRaw : null;

	if (!productId) {
		throw new Error("Missing product id");
	}
	if (delta === 0) {
		throw new Error("Quantity change must be a non-zero whole number");
	}
	if (!["INITIAL", "PURCHASE", "SALE", "ADJUSTMENT"].includes(movementType)) {
		throw new Error("Invalid movement type");
	}

	// For now we assume the common 1:1 case: a product is linked to a single inventory_item.
	const { data: recipe, error: recipeErr } = await supabase
		.from("product_inventory_recipes")
		.select("inventory_item_id")
		.eq("product_id", productId)
		.limit(1)
		.maybeSingle();
	if (recipeErr) throw recipeErr;
	if (!recipe?.inventory_item_id) {
		throw new Error("No inventory item linked to this product yet.");
	}

	const { error } = await supabase.from("inventory_movements").insert({
		inventory_item_id: recipe.inventory_item_id,
		movement_type: movementType,
		quantity: delta,
		note,
	});
	if (error) throw error;

	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

// Add or update a single recipe component for a product.
// This links a product to a specific inventory item with a per-unit quantity.
export async function addRecipeComponent(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const productId = String(formData.get("productId") || "").trim();
	const inventoryItemId = String(formData.get("inventoryItemId") || "").trim();
	const quantity = parseRecipeQuantity(formData.get("quantity"));

	if (!productId) {
		throw new Error("Missing product id");
	}
	if (!inventoryItemId) {
		throw new Error("Missing inventory item id");
	}
	if (quantity <= 0) {
		// Treat this as a validation error and redirect with an error code
		// so the page can show a friendly message instead of throwing.
		revalidatePath("/admin/products");
		redirect("/admin/products?error=recipe");
	}

	// Use upsert so each (product, inventory_item) pair only has one row.
	const { error } = await supabase
		.from("product_inventory_recipes")
		.upsert(
			{
				product_id: productId,
				inventory_item_id: inventoryItemId,
				quantity,
			},
			{ onConflict: "product_id,inventory_item_id" },
		);
	if (error) throw error;

	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}

// Remove a recipe component completely.
export async function removeRecipeComponent(formData: FormData) {
	const supabase = createSupabaseServerClient();
	const id = String(formData.get("recipeId") || "").trim();

	if (!id) {
		throw new Error("Missing recipe id");
	}

	const { error } = await supabase.from("product_inventory_recipes").delete().eq("id", id);
	if (error) throw error;

	revalidatePath("/admin/products");
	redirect("/admin/products?ok=1");
}


