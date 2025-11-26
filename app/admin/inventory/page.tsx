export const dynamic = 'force-dynamic';

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createInventoryItem } from "./actions";
import { InventoryEditDialog } from "./InventoryEditDialog";
import { InventoryDeleteButton } from "./InventoryDeleteButton";

type InventoryItemRow = {
	id: string;
	name: string;
	sku: string | null;
	unit: string;
	is_active: boolean;
	quantity_on_hand: number;
	// Simple per-unit cost used for COGS and margin reporting.
	// This is stored directly on inventory_items.unit_cost in the database.
	unit_cost: number;
};

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
	const supabase = createSupabaseServerClient();

	// Load inventory items and their current stock.
	// We keep this simple and explicit: fetch items and stock in two queries
	// and join them in memory. The stock view does not have a FK relationship
	// in PostgREST, so attempting a join in a single select would fail.
	const { data: itemRows } = await supabase
		.from("inventory_items")
		// We now also load unit_cost so the UI can show and edit per-unit costs.
		// This keeps the cost model aligned with the reporting SQL functions
		// that calculate margins from inventory_items.unit_cost.
		.select("id, name, sku, unit, is_active, unit_cost")
		.order("name", { ascending: true });
	const { data: stockRows } = await supabase
		.from("inventory_item_stock")
		.select("inventory_item_id, quantity_on_hand");

	const stockMap = new Map<string, number>();
	for (const row of stockRows ?? []) {
		const id = (row as any).inventory_item_id as string;
		const qty = Number((row as any).quantity_on_hand ?? 0);
		if (!id) continue;
		stockMap.set(id, Number.isFinite(qty) ? qty : 0);
	}

	const items: InventoryItemRow[] =
		itemRows?.map((row: any) => {
			// Normalise quantity and cost so the rest of the UI can stay dumb.
			const quantityOnHand = stockMap.get(row.id as string) ?? 0;
			const rawCost = Number((row as any).unit_cost ?? 0);
			const unitCost = Number.isFinite(rawCost) ? Number(rawCost.toFixed(2)) : 0;

			return {
				id: row.id as string,
				name: row.name as string,
				sku: (row.sku as string) ?? null,
				unit: (row.unit as string) || "PCS",
				is_active: !!row.is_active,
				quantity_on_hand: quantityOnHand,
				unit_cost: unitCost,
			};
		}) ?? [];

	const totalStockValue = items.reduce((sum, item) => {
		return sum + item.quantity_on_hand * item.unit_cost;
	}, 0);

	const sp = await searchParams;
	const ok = sp?.ok;
	const errorCode = sp?.error as string | undefined;

	return (
		<div className="space-y-4">
			<h1 className="text-3xl font-semibold">Inventory</h1>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur">
				<div className="text-sm font-medium uppercase tracking-wider text-neutral-400">
					Total Stock Value
				</div>
				<div className="mt-2 text-4xl font-bold text-emerald-400">
					₱{totalStockValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
				</div>
				<p className="mt-2 text-sm text-neutral-500">
					Calculated based on current quantity on hand and unit cost.
				</p>
			</div>

			{ok && (
				<div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
					Saved successfully.
				</div>
			)}
			{errorCode === "sku" && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
					An inventory item with this SKU already exists. Please use a different SKU or leave it blank.
				</div>
			)}
			{errorCode === "delta" && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
					Quantity change must be a non-zero whole number. Please enter a positive or negative integer.
				</div>
			)}
			{errorCode === "in_use" && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
					Cannot delete this item because it is used in product recipes. Please remove it from all recipes first.
				</div>
			)}
			{errorCode && !["sku", "delta", "in_use"].includes(errorCode) && (
				<div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
					Error: {errorCode}
				</div>
			)}

			{/*
				Quick add form for new inventory items.
				We keep this minimal: name, optional SKU, a simple unit string,
				and an optional unit cost so margins can use real COGS early on.
			*/}
			<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
				<h2 className="mb-3 text-lg font-semibold">Add Inventory Item</h2>
				<form action={createInventoryItem} className="grid grid-cols-1 gap-3 sm:grid-cols-5">
					<input
						name="name"
						placeholder="Name"
						className="rounded border px-4 py-3 text-base sm:col-span-2"
						required
					/>
					<input
						name="sku"
						placeholder="SKU (optional)"
						className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 sm:col-span-1"
					/>
					<select
						name="unit"
						className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 sm:col-span-1"
						defaultValue="PCS"
					>
						<option value="PCS">PCS</option>
						<option value="BOTTLE">BOTTLE</option>
						<option value="CAN">CAN</option>
						<option value="ML">ML</option>
						<option value="L">L</option>
						<option value="GRAM">GRAM</option>
						<option value="KG">KG</option>
					</select>
					<input
						name="unit_cost"
						type="number"
						step="0.01"
						min="0"
						placeholder="Unit cost"
						className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50"
					/>
					<div className="sm:col-span-5">
						<button type="submit" className="rounded bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800">
							Add
						</button>
					</div>
				</form>
			</div>

			<div className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 backdrop-blur overflow-x-auto">
				<table className="w-full min-w-[720px] text-base">
					<thead className="text-left text-neutral-600">
						<tr>
							<th className="py-3">Name</th>
							<th>SKU</th>
							<th>Unit</th>
							<th className="text-right">Unit cost</th>
							<th className="text-right">On hand</th>
							{/* Add a bit of extra space after stock value so the status column reads clearly. */}
							<th className="text-right pr-4">Stock value</th>
							<th className="pl-2">Status</th>
							<th className="text-right">Edit</th>
						</tr>
					</thead>
					<tbody>
						{items.map((item) => (
							<tr key={item.id} className="border-t">
								<td className="py-3">{item.name}</td>
								<td>{item.sku ?? "-"}</td>
								<td>{item.unit}</td>
								<td className="text-right font-mono">{item.unit_cost.toFixed(2)}</td>
								<td className="text-right font-mono">
									<span
										className={
											item.quantity_on_hand <= 0
												? "font-bold text-red-400"
												: item.quantity_on_hand <= 10
													? "font-bold text-amber-400"
													: ""
										}
									>
										{item.quantity_on_hand}
									</span>{" "}
									{item.unit}
								</td>
								<td className="text-right font-mono pr-4">
									{(item.quantity_on_hand * item.unit_cost).toFixed(2)}
								</td>
								<td className="pl-2">{item.is_active ? "Active" : "Inactive"}</td>
								<td className="text-right">
									<div className="flex justify-end gap-2">
										<InventoryEditDialog item={item} />
										<InventoryDeleteButton id={item.id} name={item.name} />
									</div>
								</td>
							</tr>
						))}
						{items.length === 0 && (
							<tr>
								<td colSpan={8} className="py-4 text-center text-xs text-neutral-500">
									No inventory items yet. Add one above to get started.
								</td>
							</tr>
						)}
					</tbody>
				</table>
				<p className="mt-3 text-xs text-neutral-500">
					All changes are tracked in the inventory movements table so you always have a history of stock changes.
				</p>
			</div>
		</div>
	);
}


