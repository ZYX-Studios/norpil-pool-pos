'use client';

import { useState, useMemo } from "react";
import { addRecipeComponent } from "./actions";

type InventoryItem = {
    id: string;
    name: string;
    unit: string;
    isActive: boolean;
};

type AddRecipeFormProps = {
    productId: string;
    inventoryItems: InventoryItem[];
};

// Define supported units and their conversions to a base unit if needed.
// For simplicity, we'll define groups of compatible units.
const UNIT_GROUPS: Record<string, string[]> = {
    // Mass
    'KG': ['KG', 'GRAM'],
    'GRAM': ['GRAM', 'KG'],
    // Volume
    'L': ['L', 'ML'],
    'ML': ['ML', 'L'],
    // Count
    'PCS': ['PCS'],
    'BOTTLE': ['BOTTLE'],
    'CAN': ['CAN'],
};

export function AddRecipeForm({ productId, inventoryItems }: AddRecipeFormProps) {
    const [selectedItemId, setSelectedItemId] = useState("");

    // Find the selected item to know its base unit
    const selectedItem = useMemo(() =>
        inventoryItems.find(i => i.id === selectedItemId),
        [inventoryItems, selectedItemId]);

    // Determine available units based on the selected item's base unit
    const availableUnits = useMemo(() => {
        if (!selectedItem) return [];
        const baseUnit = selectedItem.unit;
        return UNIT_GROUPS[baseUnit] || [baseUnit];
    }, [selectedItem]);

    return (
        <form action={addRecipeComponent} className="mt-4 flex flex-wrap items-end gap-4">
            <input type="hidden" name="productId" value={productId} />

            <div className="min-w-[200px] flex-1">
                <label className="mb-1 block text-sm text-neutral-500">Inventory item</label>
                <select
                    name="inventoryItemId"
                    className="w-full rounded-md border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50"
                    value={selectedItemId}
                    onChange={(e) => setSelectedItemId(e.target.value)}
                    required
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
                <label className="mb-1 block text-sm text-neutral-500">Quantity</label>
                <input
                    name="quantity"
                    type="number"
                    step="0.0001"
                    min="0"
                    className="w-32 rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                    placeholder="1"
                    required
                />
            </div>

            {availableUnits.length > 0 && (
                <div className="w-32">
                    <label className="mb-1 block text-sm text-neutral-500">Unit</label>
                    <select
                        name="unit"
                        className="w-full rounded-md border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50"
                        defaultValue={selectedItem?.unit}
                    >
                        {availableUnits.map(u => (
                            <option key={u} value={u}>{u}</option>
                        ))}
                    </select>
                </div>
            )}

            <button
                type="submit"
                className="rounded-md bg-neutral-900 px-6 py-3 text-base font-medium text-white hover:bg-neutral-800"
            >
                Add / update
            </button>
        </form>
    );
}
