export const dynamic = 'force-dynamic';
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
	createProduct,
	updateProduct,
	toggleActiveAction,
	deleteProductAction,
	createManyProducts,
	adjustInventory,
	addRecipeComponent,
	removeRecipeComponent,
} from "./actions";
import { ProductEditDialog } from "./ProductEditDialog";

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const supabase = createSupabaseServerClient();

	// Load base product data.
	const { data: products } = await supabase
		.from("products")
		.select("id, name, sku, category, price, tax_rate, is_active, is_alcoholic")
		.order("name", { ascending: true });

	// Load current stock using the product_stock view built on inventory_movements.
	const { data: stockRows } = await supabase.from("product_stock").select("product_id, quantity_on_hand");
	const stockMap = new Map<string, number>();
	for (const row of stockRows ?? []) {
		// Keep parsing simple and defensive; bad rows just show as zero.
		const qty = Number((row as any).quantity_on_hand ?? 0);
		stockMap.set((row as any).product_id as string, Number.isFinite(qty) ? qty : 0);
	}

	// Load inventory items so recipes can reference a clean, curated list.
	const { data: inventoryItemRows } = await supabase
		.from("inventory_items")
		.select("id, name, unit, is_active")
		.order("name", { ascending: true });
	const inventoryItems =
		inventoryItemRows?.map((row: any) => ({
			id: row.id as string,
			name: row.name as string,
			unit: (row.unit as string) || "PCS",
			isActive: !!row.is_active,
		})) ?? [];

	// Load recipes and group them per product for easy display.
	// Load inventory stock to show availability per ingredient.
	const { data: invStockRows } = await supabase.from("inventory_item_stock").select("inventory_item_id, quantity_on_hand");
	const inventoryStockMap = new Map<string, number>();
	for (const row of invStockRows ?? []) {
		const id = (row as any).inventory_item_id as string;
		const qty = Number((row as any).quantity_on_hand ?? 0);
		if (id) inventoryStockMap.set(id, Number.isFinite(qty) ? qty : 0);
	}

	const { data: recipeRows } = await supabase
		.from("product_inventory_recipes")
		.select("id, product_id, inventory_item_id, quantity")
		.order("product_id", { ascending: true });
	const inventoryById = new Map<string, { id: string; name: string; unit: string }>();
	for (const item of inventoryItems) {
		inventoryById.set(item.id, { id: item.id, name: item.name, unit: item.unit });
	}
	const recipeByProduct = new Map<
		string,
		Array<{ id: string; inventoryItemId: string; name: string; unit: string; quantity: number; stock: number }>
	>();
	for (const row of recipeRows ?? []) {
		const pid = (row as any).product_id as string;
		const inventoryItemId = (row as any).inventory_item_id as string;
		if (!pid || !inventoryItemId) continue;
		const info = inventoryById.get(inventoryItemId);
		if (!info) continue;
		const qty = Number((row as any).quantity ?? 0);
		const safeQty = Number.isFinite(qty) && qty > 0 ? qty : 0;
		const list = recipeByProduct.get(pid) ?? [];
		list.push({
			id: (row as any).id as string,
			inventoryItemId,
			name: info.name,
			unit: info.unit,
			quantity: safeQty,
			stock: inventoryStockMap.get(inventoryItemId) ?? 0,
		});
		recipeByProduct.set(pid, list);
	}

	const sp = await searchParams;
	const ok = sp?.ok;
	const errorCode = sp?.error as string | undefined;

	return (
		<div className="space-y-4">
			<h1 className="text-3xl font-semibold">Products</h1>
			{ok && (
				<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
					Saved successfully.
				</div>
			)}
			{errorCode === "recipe" && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
					Recipe quantity must be greater than zero. Please enter a positive number (e.g. 1 or 0.25).
				</div>
			)}
			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur">
				<h2 className="mb-3 text-lg font-semibold">Add Product</h2>
				<form action={createProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
					<input name="name" placeholder="Name" className="rounded border px-4 py-3 text-base sm:col-span-2" required />
					<input name="sku" placeholder="SKU (optional)" className="rounded border px-4 py-3 text-base sm:col-span-1" />
					<select
						name="category"
						className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 sm:col-span-1"
						defaultValue="FOOD"
					>
						<option value="FOOD">FOOD</option>
						<option value="DRINK">DRINK</option>
						<option value="OTHER">OTHER</option>
						<option value="TABLE_TIME">TABLE_TIME</option>
					</select>
					<input name="price" placeholder="Price" type="number" step="0.01" min="0" className="rounded border px-4 py-3 text-base sm:col-span-1" required />
					<input name="tax_rate" placeholder="Tax rate (e.g. 0.12)" type="number" step="0.01" min="0" className="rounded border px-4 py-3 text-base sm:col-span-1" defaultValue="0.12" />

					<div className="sm:col-span-6 flex items-center gap-2">
						<input type="checkbox" name="is_alcoholic" id="is_alcoholic_new" className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500" />
						<label htmlFor="is_alcoholic_new" className="text-sm text-neutral-300">Is Alcoholic (Drinks only)</label>
					</div>

					<div className="sm:col-span-6">
						<button type="submit" className="rounded bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800">
							Add
						</button>
					</div>
				</form>
			</div>

			<details className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<summary className="mb-3 cursor-pointer select-none text-base font-semibold">Add Multiple (CSV lines)</summary>
				<p className="mb-2 text-xs text-neutral-500">
					Format per line: name, sku(optional), category(FOOD|DRINK|OTHER|TABLE_TIME), price, tax_rate(optional)
				</p>
				<form action={createManyProducts} className="space-y-3">
					<textarea name="lines" rows={5} className="w-full rounded border px-3 py-2 text-sm" placeholder="Coke, DRK-COKE, DRINK, 60, 0.12&#10;Burger, FD-BURGER, FOOD, 180, 0.12"></textarea>
					<button type="submit" className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800">
						Import
					</button>
				</form>
			</details>

			{/* 
				Wrap the products table in a scrollable container.
				This prevents horizontal overflow on small mobile screens while keeping columns readable on desktop.
			*/}
			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur overflow-x-auto">
				<table className="w-full min-w-[700px] text-base">
					<thead className="text-left text-neutral-600">
						<tr>
							<th className="py-3">Name</th>
							<th>SKU</th>
							<th>Category</th>
							<th className="text-right">Price</th>
							<th className="text-right">Stock</th>
							<th className="text-right">Tax</th>
							<th>Status</th>
							<th className="text-right">Actions</th>
						</tr>
					</thead>
					<tbody>
						{(products ?? []).map((p) => {
							const stock = stockMap.get(p.id as string) ?? 0;
							const recipeComponents = recipeByProduct.get(p.id as string) ?? [];
							return (
								<tr key={p.id} className="border-t">
									<td className="py-3">{p.name}</td>
									<td>{p.sku ?? "-"}</td>
									<td>{p.category}</td>
									<td className="text-right">{formatCurrency(Number(p.price))}</td>
									<td className="text-right font-mono">{stock}</td>
									<td className="text-right">{(Number(p.tax_rate) * 100).toFixed(2)}%</td>
									<td>{p.is_active ? "Active" : "Inactive"}</td>
									<td className="text-right">
										<div className="flex justify-end gap-2">
											<form action={toggleActiveAction.bind(null, p.id as string, !!p.is_active)}>
												<button type="submit" className="rounded border border-white/20 bg-black/30 px-3 py-1.5 text-sm hover:bg-white/10">
													{p.is_active ? "Deactivate" : "Activate"}
												</button>
											</form>
											<ProductEditDialog
												product={{
													id: p.id as string,
													name: p.name as string,
													sku: p.sku as string,
													category: p.category as string,
													price: Number(p.price),
													tax_rate: Number(p.tax_rate),
													is_active: !!p.is_active,
													is_alcoholic: !!p.is_alcoholic,
												}}
												stock={stock}
												inventoryItems={inventoryItems}
												recipeComponents={recipeComponents}
											/>
										</div>
									</td>
								</tr>
							);
						})}
					</tbody>
				</table>
				<p className="mt-3 text-xs text-neutral-500">
					Note: Deleting a product that is referenced by past orders will fail due to FK constraints. Use Deactivate instead.
				</p>
			</div>
		</div>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" }).format(n);
}


