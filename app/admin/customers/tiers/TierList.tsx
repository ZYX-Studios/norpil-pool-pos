"use client";

import { useState } from "react";
import { createTier, updateTier, deleteTier } from "./actions";
import { Trash2, Edit2, Check, X, Plus } from "lucide-react";

interface Tier {
    id: string;
    name: string;
    discount_percentage: number;
    min_wallet_balance: number;
    color: string;
}

export function TierList({ tiers }: { tiers: Tier[] }) {
    const [editingId, setEditingId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-white">Active Tiers</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    disabled={isCreating}
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-400 rounded-xl hover:bg-emerald-500/20 disabled:opacity-50 border border-emerald-500/30 transition-all font-medium text-sm"
                >
                    <Plus className="w-4 h-4" />
                    New Tier
                </button>
            </div>

            <div className="grid gap-4">
                {isCreating && (
                    <form
                        action={async (formData) => {
                            await createTier(formData);
                            setIsCreating(false);
                        }}
                        className="p-4 rounded-2xl bg-neutral-900/50 border border-emerald-500/30 shadow-lg flex flex-col md:flex-row gap-4 items-end"
                    >
                        <div className="flex-1 space-y-1 w-full">
                            <label className="text-xs text-neutral-400 uppercase font-medium">Name</label>
                            <input
                                name="name"
                                required
                                placeholder="e.g. Gold"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="w-full md:w-32 space-y-1">
                            <label className="text-xs text-neutral-400 uppercase font-medium">Discount %</label>
                            <input
                                name="discount"
                                type="number"
                                min="0"
                                max="100"
                                step="0.1"
                                defaultValue="0"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="w-full md:w-40 space-y-1">
                            <label className="text-xs text-neutral-400 uppercase font-medium">Min Balance (₱)</label>
                            <input
                                name="minWallet"
                                type="number"
                                min="0"
                                step="100"
                                defaultValue="0"
                                className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-emerald-500"
                            />
                        </div>
                        <div className="w-full md:w-32 space-y-1">
                            <label className="text-xs text-neutral-400 uppercase font-medium">Color</label>
                            <div className="flex items-center gap-2">
                                <input
                                    name="color"
                                    type="color"
                                    defaultValue="#fbbf24"
                                    className="h-9 w-full bg-transparent cursor-pointer rounded-lg border border-white/10"
                                />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 pb-1">
                            <button
                                type="submit"
                                className="p-2 bg-emerald-500 text-black rounded-lg hover:bg-emerald-400"
                            >
                                <Check className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                onClick={() => setIsCreating(false)}
                                className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </form>
                )}

                {tiers.map((tier) => {
                    const isEditing = editingId === tier.id;
                    return (
                        <div
                            key={tier.id}
                            className="p-4 rounded-2xl bg-neutral-900/50 border border-white/5 shadow-sm hover:border-white/10 transition-colors"
                        >
                            {isEditing ? (
                                <form
                                    action={async (formData) => {
                                        await updateTier(formData);
                                        setEditingId(null);
                                    }}
                                    className="flex flex-col md:flex-row gap-4 items-end"
                                >
                                    <input type="hidden" name="id" value={tier.id} />
                                    <div className="flex-1 space-y-1 w-full">
                                        <label className="text-xs text-neutral-400 uppercase font-medium">Name</label>
                                        <input
                                            name="name"
                                            required
                                            defaultValue={tier.name}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="w-full md:w-32 space-y-1">
                                        <label className="text-xs text-neutral-400 uppercase font-medium">Discount %</label>
                                        <input
                                            name="discount"
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.1"
                                            defaultValue={tier.discount_percentage}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="w-full md:w-40 space-y-1">
                                        <label className="text-xs text-neutral-400 uppercase font-medium">Min Balance (₱)</label>
                                        <input
                                            name="minWallet"
                                            type="number"
                                            min="0"
                                            step="100"
                                            defaultValue={tier.min_wallet_balance}
                                            className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-indigo-500"
                                        />
                                    </div>
                                    <div className="w-full md:w-32 space-y-1">
                                        <label className="text-xs text-neutral-400 uppercase font-medium">Color</label>
                                        <input
                                            name="color"
                                            type="color"
                                            defaultValue={tier.color}
                                            className="h-9 w-full bg-transparent cursor-pointer rounded-lg border border-white/10"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 pb-1">
                                        <button
                                            type="submit"
                                            className="p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-400"
                                        >
                                            <Check className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setEditingId(null)}
                                            className="p-2 bg-neutral-800 text-neutral-400 rounded-lg hover:text-white"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4">
                                        <div
                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-xs font-bold shadow-lg"
                                            style={{ backgroundColor: `${tier.color}20`, color: tier.color, border: `1px solid ${tier.color}40` }}
                                        >
                                            {tier.discount_percentage}%
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-white text-lg">{tier.name}</h3>
                                            <p className="text-sm text-neutral-400">
                                                Min. Balance: <span className="text-neutral-200">₱{tier.min_wallet_balance.toLocaleString()}</span>
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => setEditingId(tier.id)}
                                            className="p-2 text-neutral-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <form
                                            action={deleteTier}
                                            onSubmit={(e) => {
                                                if (!confirm("Are you sure you want to delete this tier?")) {
                                                    e.preventDefault();
                                                }
                                            }}
                                        >
                                            <input type="hidden" name="id" value={tier.id} />
                                            <button
                                                type="submit"
                                                className="p-2 text-neutral-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {tiers.length === 0 && !isCreating && (
                    <div className="text-center py-12 text-neutral-500 border border-dashed border-white/5 rounded-2xl">
                        No membership tiers configured yet.
                    </div>
                )}
            </div>
        </div>
    );
}
