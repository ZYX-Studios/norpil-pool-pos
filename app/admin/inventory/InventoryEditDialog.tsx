'use client';

import { useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { adjustInventoryItem, updateInventoryItem, deleteInventoryItemAction } from "./actions";

type InventoryEditDialogProps = {
	item: {
		id: string;
		name: string;
		sku: string | null;
		unit: string;
		is_active: boolean;
		quantity_on_hand: number;
		// Per-unit cost used for reporting margins. This is stored in
		// inventory_items.unit_cost and is kept simple: numeric with 2 decimals.
		unit_cost: number;
	};
};

// Simple modal dialog for editing a single inventory item.
// This keeps the main table clean and gives more space for the form.
export function InventoryEditDialog({ item }: InventoryEditDialogProps) {
	const [open, setOpen] = useState(false);
	const router = useRouter();

	return (
		<>
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="rounded border border-white/20 bg-black/30 px-4 py-2 text-sm text-neutral-50 hover:bg-white/10"
			>
				Edit
			</button>
			{open &&
				typeof document !== "undefined" &&
				createPortal(
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
						<div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-neutral-950/95 p-6 text-base text-neutral-50 shadow-xl shadow-black/80">
							<div className="mb-4 flex items-start justify-between gap-4">
								<div>
									<div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
										Inventory item
									</div>
									<div className="text-xl font-semibold">{item.name}</div>
									<div className="mt-1 text-sm text-neutral-400">
										On hand:{" "}
										<span className="font-mono">
											{item.quantity_on_hand} {item.unit}
										</span>
									</div>
								</div>
								<button
									type="button"
									onClick={() => setOpen(false)}
									className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10"
								>
									Close
								</button>
							</div>

							<div className="grid gap-4 md:grid-cols-2">
								{/* Item details */}
								<div className="space-y-4 border border-white/10 bg-black/40 p-4 rounded-xl">
									<div className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">
										Item details
									</div>
									<form action={updateInventoryItem} className="space-y-2">
										<input type="hidden" name="id" value={item.id} />
										<div>
											<label className="mb-1 block text-sm text-neutral-400">Name</label>
											<input
												name="name"
												defaultValue={item.name}
												className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
												required
											/>
										</div>
										<div>
											<label className="mb-1 block text-sm text-neutral-400">Unit cost</label>
											<input
												name="unit_cost"
												type="number"
												step="0.01"
												min="0"
												defaultValue={item.unit_cost.toFixed(2)}
												placeholder="0.00"
												className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
											/>
										</div>
										<div>
											<label className="mb-1 block text-sm text-neutral-400">SKU</label>
											<input
												name="sku"
												defaultValue={item.sku ?? ""}
												placeholder="Leave blank to auto-generate"
												className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
											/>
										</div>
										<div className="flex gap-2">
											<div className="flex-1">
												<label className="mb-1 block text-sm text-neutral-400">Unit</label>
												<select
													name="unit"
													defaultValue={item.unit}
													className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
												>
													<option value="PCS">PCS</option>
													<option value="BOTTLE">BOTTLE</option>
													<option value="CAN">CAN</option>
													<option value="ML">ML</option>
													<option value="L">L</option>
													<option value="GRAM">GRAM</option>
													<option value="KG">KG</option>
												</select>
											</div>
											<div className="flex-1">
												<label className="mb-1 block text-sm text-neutral-400">Status</label>
												<div className="flex items-center gap-3 text-sm h-[50px]">
													<label className="flex items-center gap-2">
														<input
															type="radio"
															name="is_active"
															value="true"
															defaultChecked={item.is_active}
															className="h-4 w-4"
														/>
														<span>Active</span>
													</label>
													<label className="flex items-center gap-2">
														<input
															type="radio"
															name="is_active"
															value="false"
															defaultChecked={!item.is_active}
															className="h-4 w-4"
														/>
														<span>Inactive</span>
													</label>
												</div>
											</div>
										</div>
										<button
											type="submit"
											className="mt-2 w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800"
										>
											Save item
										</button>
									</form>
								</div>

								{/* Stock adjustment */}
								<div className="space-y-4 rounded-xl border border-amber-500/20 bg-black/40 p-4">
									<div className="mb-1 text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">
										Adjust stock
									</div>
									<form action={adjustInventoryItem} className="space-y-2">
										<input type="hidden" name="inventoryItemId" value={item.id} />
										<div className="flex gap-2">
											<div className="w-32">
												<label className="mb-1 block text-sm text-neutral-400">Change</label>
												<input
													name="delta"
													type="number"
													step="1"
													className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
													placeholder="+10"
												/>
											</div>
											<div className="flex-1">
												<label className="mb-1 block text-sm text-neutral-400">Type</label>
												<select
													name="movement_type"
													defaultValue="ADJUSTMENT"
													className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
												>
													<option value="INITIAL">Initial</option>
													<option value="PURCHASE">Purchase</option>
													<option value="ADJUSTMENT">Adjustment</option>
												</select>
											</div>
										</div>
										<div>
											<label className="mb-1 block text-sm text-neutral-400">Note</label>
											<input
												name="note"
												className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
												placeholder="Optional note (e.g. delivery, spoilage)"
											/>
										</div>
										<button
											type="submit"
											className="mt-2 w-full rounded-md bg-amber-500 px-4 py-3 text-base font-semibold text-neutral-900 hover:bg-amber-400"
										>
											Apply change
										</button>
									</form>
								</div>
							</div>
						</div>
					</div >,
					document.body,
				)
			}
		</>
	);
}


