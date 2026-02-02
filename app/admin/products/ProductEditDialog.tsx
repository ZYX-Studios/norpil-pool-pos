'use client';

import { useState } from "react";
import { createPortal } from "react-dom";
import { updateProduct, adjustInventory, removeRecipeComponent, deleteProductAction } from "./actions";
import { AddRecipeForm } from "./AddRecipeForm";

type Product = {
    id: string;
    name: string;
    sku: string | null;
    category: string;
    price: number;
    tax_rate: number;
    is_active: boolean;
    is_alcoholic: boolean;
};

type InventoryItem = {
    id: string;
    name: string;
    unit: string;
    isActive: boolean;
};

type RecipeComponent = {
    id: string;
    inventoryItemId: string;
    name: string;
    unit: string;
    quantity: number;
    stock: number;
};

type ProductEditDialogProps = {
    product: Product;
    stock: number;
    inventoryItems: InventoryItem[];
    recipeComponents: RecipeComponent[];
};

type Tab = "DETAILS" | "INVENTORY" | "RECIPE";

export function ProductEditDialog({ product, stock, inventoryItems, recipeComponents }: ProductEditDialogProps) {
    const [open, setOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<Tab>("DETAILS");

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded border border-white/20 bg-black/30 px-2 py-1 text-sm text-neutral-50 hover:bg-white/10"
            >
                Edit
            </button>
            {open &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                        <div className="flex h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-neutral-950/95 text-base text-neutral-50 shadow-xl shadow-black/80">
                            {/* Header */}
                            <div className="flex items-start justify-between border-b border-white/10 p-6">
                                <div>
                                    <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-500">
                                        Edit Product
                                    </div>
                                    <div className="text-2xl font-semibold">{product.name}</div>
                                    <div className="mt-1 text-sm text-neutral-400">
                                        {product.category} · {product.sku || "No SKU"}
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

                            {/* Tabs */}
                            <div className="flex border-b border-white/10 px-6">
                                <button
                                    onClick={() => setActiveTab("DETAILS")}
                                    className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "DETAILS"
                                        ? "border-emerald-500 text-emerald-400"
                                        : "border-transparent text-neutral-400 hover:text-neutral-200"
                                        }`}
                                >
                                    Details
                                </button>
                                <button
                                    onClick={() => setActiveTab("INVENTORY")}
                                    className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "INVENTORY"
                                        ? "border-emerald-500 text-emerald-400"
                                        : "border-transparent text-neutral-400 hover:text-neutral-200"
                                        }`}
                                >
                                    Inventory
                                </button>
                                <button
                                    onClick={() => setActiveTab("RECIPE")}
                                    className={`border-b-2 px-4 py-3 text-sm font-medium transition-colors ${activeTab === "RECIPE"
                                        ? "border-emerald-500 text-emerald-400"
                                        : "border-transparent text-neutral-400 hover:text-neutral-200"
                                        }`}
                                >
                                    Recipe
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {activeTab === "DETAILS" && (
                                    <div className="space-y-6">
                                        <form action={updateProduct} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <input type="hidden" name="id" value={product.id} />
                                            <div className="sm:col-span-2">
                                                <label className="mb-1 block text-sm text-neutral-400">Name</label>
                                                <input
                                                    name="name"
                                                    defaultValue={product.name}
                                                    className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm text-neutral-400">SKU</label>
                                                <input
                                                    name="sku"
                                                    defaultValue={product.sku ?? ""}
                                                    className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm text-neutral-400">Category</label>
                                                <select
                                                    name="category"
                                                    defaultValue={product.category}
                                                    className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                >
                                                    <option value="FOOD">FOOD</option>
                                                    <option value="DRINK">DRINK</option>
                                                    <option value="OTHER">OTHER</option>
                                                    <option value="TABLE_TIME">TABLE_TIME</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm text-neutral-400">Price</label>
                                                <input
                                                    name="price"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    defaultValue={product.price}
                                                    className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                    required
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm text-neutral-400">Tax Rate</label>
                                                <input
                                                    name="tax_rate"
                                                    type="number"
                                                    step="0.01"
                                                    min="0"
                                                    defaultValue={product.tax_rate}
                                                    className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                />
                                            </div>
                                            <div className="sm:col-span-2 flex items-center gap-2 pt-2">
                                                <input
                                                    type="checkbox"
                                                    name="is_alcoholic"
                                                    id={`is_alcoholic_${product.id}`}
                                                    defaultChecked={product.is_alcoholic}
                                                    className="h-4 w-4 rounded border-white/20 bg-black/40 text-emerald-500 focus:ring-emerald-500"
                                                />
                                                <label htmlFor={`is_alcoholic_${product.id}`} className="text-sm text-neutral-300">
                                                    Is Alcoholic (Drinks only)
                                                </label>
                                            </div>
                                            <div className="sm:col-span-2 pt-4">
                                                <button
                                                    type="submit"
                                                    className="w-full rounded-md bg-neutral-900 px-4 py-3 text-base font-medium text-white hover:bg-neutral-800"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </form>

                                        <div className="border-t border-white/10 pt-6">
                                            <h3 className="mb-2 text-sm font-semibold text-red-400">Danger Zone</h3>
                                            <p className="mb-4 text-sm text-neutral-500">
                                                Deleting a product is irreversible. If this product has been sold before, consider deactivating it instead.
                                            </p>
                                            <form action={deleteProductAction.bind(null, product.id)}>
                                                <button
                                                    type="submit"
                                                    className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-medium text-red-400 hover:bg-red-500/20"
                                                    onClick={(e) => {
                                                        if (!confirm("Are you sure you want to delete this product?")) {
                                                            e.preventDefault();
                                                        }
                                                    }}
                                                >
                                                    Delete Product
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "INVENTORY" && (
                                    <div className="space-y-6">
                                        <div className="rounded-xl border border-white/10 bg-black/20 p-6 text-center">
                                            <div className="text-sm text-neutral-400">Current Stock</div>
                                            <div className="mt-2 text-5xl font-bold text-emerald-400">{stock}</div>
                                        </div>

                                        <div className="rounded-xl border border-amber-500/20 bg-black/40 p-6">
                                            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-amber-300">
                                                Adjust Stock
                                            </div>
                                            <form action={adjustInventory} className="space-y-4">
                                                <input type="hidden" name="productId" value={product.id} />
                                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                    <div>
                                                        <label className="mb-1 block text-sm text-neutral-400">Change (+/-)</label>
                                                        <input
                                                            name="delta"
                                                            type="number"
                                                            step="1"
                                                            className="w-full rounded-md border border-white/15 bg-black/60 px-4 py-3 text-base text-neutral-50"
                                                            placeholder="+10"
                                                            required
                                                        />
                                                    </div>
                                                    <div>
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
                                                    className="w-full rounded-md bg-amber-500 px-4 py-3 text-base font-semibold text-neutral-900 hover:bg-amber-400"
                                                >
                                                    Apply Adjustment
                                                </button>
                                            </form>
                                        </div>
                                    </div>
                                )}

                                {activeTab === "RECIPE" && (
                                    <div className="space-y-6">
                                        <div className="rounded-xl border border-white/10 bg-black/20 p-6">
                                            <div className="mb-4 flex items-center justify-between">
                                                <div className="text-sm font-semibold uppercase tracking-[0.14em] text-neutral-400">
                                                    Ingredients
                                                </div>
                                                <div className="text-xs text-neutral-500">
                                                    Deducted from inventory when sold
                                                </div>
                                            </div>

                                            {recipeComponents.length > 0 ? (
                                                <div className="space-y-3">
                                                    {recipeComponents.map((comp) => (
                                                        <div key={comp.id} className="flex items-center justify-between rounded-lg border border-white/5 bg-white/5 p-4">
                                                            <div>
                                                                <div className="font-medium text-neutral-200">{comp.name}</div>
                                                                <div className="text-sm text-neutral-500">
                                                                    {comp.quantity} {comp.unit} per unit
                                                                    <span className="ml-2 text-xs text-neutral-400">
                                                                        (Stock: {comp.stock} {comp.unit})
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <form action={removeRecipeComponent}>
                                                                <input type="hidden" name="recipeId" value={comp.id} />
                                                                <button
                                                                    type="submit"
                                                                    className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
                                                                >
                                                                    Remove
                                                                </button>
                                                            </form>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div className="py-8 text-center text-sm text-neutral-500">
                                                    No ingredients yet. Add items below to track inventory usage.
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-xl border border-emerald-500/20 bg-black/40 p-6">
                                            <div className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-emerald-400">
                                                Add Ingredient
                                            </div>
                                            <AddRecipeForm productId={product.id} inventoryItems={inventoryItems} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
