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

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const supabase = createSupabaseServerClient();

	// Load base product data.
	const { data: products } = await supabase
		.from("products")
		.select("id, name, sku, category, price, tax_rate, is_active")
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
		Array<{ id: string; inventoryItemId: string; name: string; unit: string; quantity: number }>
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
		});
		recipeByProduct.set(pid, list);
	}

	const sp = await searchParams;
	const ok = sp?.ok;
	const errorCode = sp?.error as string | undefined;

	return (
		<div className="space-y-4">
			<h1 className="text-2xl font-semibold">Products</h1>
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
			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<h2 className="mb-3 text-base font-semibold">Add Product</h2>
				<form action={createProduct} className="grid grid-cols-1 gap-3 sm:grid-cols-6">
					<input name="name" placeholder="Name" className="rounded border px-3 py-2 text-sm sm:col-span-2" required />
					<input name="sku" placeholder="SKU (optional)" className="rounded border px-3 py-2 text-sm sm:col-span-1" />
					<select
						name="category"
						className="rounded border border-white/20 bg-black/40 px-3 py-2 text-sm text-neutral-50 sm:col-span-1"
						defaultValue="FOOD"
					>
						<option value="FOOD">FOOD</option>
						<option value="DRINK">DRINK</option>
						<option value="OTHER">OTHER</option>
						<option value="TABLE_TIME">TABLE_TIME</option>
					</select>
					<input name="price" placeholder="Price" type="number" step="0.01" min="0" className="rounded border px-3 py-2 text-sm sm:col-span-1" required />
					<input name="tax_rate" placeholder="Tax rate (e.g. 0.12)" type="number" step="0.01" min="0" className="rounded border px-3 py-2 text-sm sm:col-span-1" defaultValue="0.12" />
					<div className="sm:col-span-6">
						<button type="submit" className="rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800">
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
			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur overflow-x-auto">
				<table className="w-full min-w-[700px] text-sm">
					<thead className="text-left text-neutral-600">
						<tr>
							<th className="py-2">Name</th>
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
									<td className="py-2">{p.name}</td>
									<td>{p.sku ?? "-"}</td>
									<td>{p.category}</td>
									<td className="text-right">{formatCurrency(Number(p.price))}</td>
									<td className="text-right font-mono">{stock}</td>
									<td className="text-right">{(Number(p.tax_rate) * 100).toFixed(2)}%</td>
									<td>{p.is_active ? "Active" : "Inactive"}</td>
									<td className="text-right">
										<div className="flex justify-end gap-2">
											<form action={toggleActiveAction.bind(null, p.id as string, !!p.is_active)}>
												<button type="submit" className="rounded border px-2 py-1 hover:bg-neutral-50">
													{p.is_active ? "Deactivate" : "Activate"}
												</button>
											</form>
											<details>
												<summary className="cursor-pointer select-none rounded border px-2 py-1 hover:bg-neutral-50">Edit</summary>
												<div className="mt-2 space-y-3">
													<form action={updateProduct} className="grid grid-cols-1 gap-2 sm:grid-cols-6">
														<input type="hidden" name="id" value={p.id as string} />
														<input name="name" defaultValue={p.name as string} className="rounded border px-2 py-1 text-sm sm:col-span-2" required />
														<input
															name="sku"
															defaultValue={(p.sku as string) ?? ""}
															className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-neutral-50 sm:col-span-1"
														/>
														<select
															name="category"
															defaultValue={p.category as string}
															className="rounded border border-white/20 bg-black/40 px-2 py-1 text-sm text-neutral-50 sm:col-span-1"
														>
															<option value="FOOD">FOOD</option>
															<option value="DRINK">DRINK</option>
															<option value="OTHER">OTHER</option>
															<option value="TABLE_TIME">TABLE_TIME</option>
														</select>
														<input name="price" type="number" step="0.01" min="0" defaultValue={String(p.price)} className="rounded border px-2 py-1 text-sm sm:col-span-1" required />
														<input name="tax_rate" type="number" step="0.01" min="0" defaultValue={String(p.tax_rate)} className="rounded border px-2 py-1 text-sm sm:col-span-1" />
														<div className="sm:col-span-6">
															<button type="submit" className="rounded bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800">
																Save
															</button>
														</div>
													</form>

													{/* 
														Simple inventory adjustment block.
														Admins can bump stock up or down without leaving the products page.
													*/}
													<div className="rounded border border-white/10 bg-black/5 p-2 text-xs">
														<div className="mb-1 flex items-center justify-between">
															<span className="font-medium">Inventory</span>
															<span className="font-mono text-[11px] text-neutral-500">Current: {stock}</span>
														</div>
														<form action={adjustInventory} className="flex flex-wrap items-end gap-2">
															<input type="hidden" name="productId" value={p.id as string} />
															<div>
																<label className="block text-[10px] text-neutral-500">Change</label>
																<input
																	name="delta"
																	type="number"
																	step="1"
																	className="w-20 rounded border px-2 py-1 text-xs"
																	placeholder="+10"
																/>
															</div>
															<div>
																<label className="block text-[10px] text-neutral-500">Type</label>
																<select
																	name="movement_type"
																	defaultValue="ADJUSTMENT"
																	className="rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-neutral-50"
																>
																	<option value="INITIAL">Initial</option>
																	<option value="PURCHASE">Purchase</option>
																	<option value="ADJUSTMENT">Adjustment</option>
																</select>
															</div>
															<div className="min-w-[140px] flex-1">
																<label className="block text-[10px] text-neutral-500">Note</label>
																<input
																	name="note"
																	className="w-full rounded border px-2 py-1 text-xs"
																	placeholder="Optional note (e.g. delivery, spoilage)"
																/>
															</div>
															<button
																type="submit"
																className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-800"
															>
																Apply
															</button>
														</form>
													</div>

													{/* 
														Inventory recipe editor.
														This makes the link between menu products and stock explicit:
														which inventory items are consumed, and how much per unit.
													*/}
													<div className="rounded border border-white/10 bg-black/5 p-2 text-xs">
														<div className="mb-1 flex items-center justify-between">
															<span className="font-medium">Inventory recipe</span>
															<span className="text-[10px] text-neutral-500">
																Used to deduct stock when this item is sold.
															</span>
														</div>
														<div className="space-y-1">
															{recipeComponents.length > 0 ? (
																recipeComponents.map((comp) => (
																	<div key={comp.id} className="flex items-center justify-between gap-2">
																		<div>
																			<div className="font-medium">{comp.name}</div>
																			<div className="text-[10px] text-neutral-500">
																				{comp.quantity} {comp.unit} per {p.name}
																			</div>
																		</div>
																		<form action={removeRecipeComponent} className="shrink-0">
																			<input type="hidden" name="recipeId" value={comp.id} />
																			<button
																				type="submit"
																				className="rounded border px-2 py-0.5 text-[10px] text-red-500 hover:bg-red-50"
																			>
																				Remove
																			</button>
																		</form>
																	</div>
																))
															) : (
																<div className="text-[11px] text-neutral-500">
																	No recipe yet. Add at least one inventory item if this product should track stock.
																</div>
															)}
														</div>
														<form action={addRecipeComponent} className="mt-2 flex flex-wrap items-end gap-2">
															<input type="hidden" name="productId" value={p.id as string} />
															<div className="min-w-[140px] flex-1">
																<label className="block text-[10px] text-neutral-500">Inventory item</label>
																<select
																	name="inventoryItemId"
																	className="w-full rounded border border-white/20 bg-black/40 px-2 py-1 text-xs text-neutral-50"
																	defaultValue=""
																>
																	<option value="">Select item…</option>
																	{inventoryItems
																		.filter((it) => it.isActive)
																		.map((it) => (
																			<option key={it.id} value={it.id}>
																				{it.name} ({it.unit})
																			</option>
																		))}
																</select>
															</div>
															<div>
																<label className="block text-[10px] text-neutral-500">Quantity per unit</label>
																<input
																	name="quantity"
																	type="number"
																	step="0.0001"
																	min="0"
																	className="w-24 rounded border px-2 py-1 text-xs"
																	placeholder="1"
																/>
															</div>
															<button
																type="submit"
																className="rounded bg-neutral-900 px-2 py-1 text-xs font-medium text-white hover:bg-neutral-800"
															>
																Add / update
															</button>
														</form>
													</div>
												</div>
											</details>
											<form action={deleteProductAction.bind(null, p.id as string)}>
												<button type="submit" className="rounded border px-2 py-1 text-red-600 hover:bg-red-50">
													Delete
												</button>
											</form>
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


