"use client";

import { useState } from "react";
import { updateCustomerTier } from "./actions";
import { Check, ChevronDown, UserCheck, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tier {
    id: string;
    name: string;
    discount_percentage: number;
    color: string;
}

interface CustomerTierManagerProps {
    customerId: string;
    currentTierId: string | null;
    isMember: boolean;
    tiers: Tier[];
}

export function CustomerTierManager({ customerId, currentTierId, isMember, tiers }: CustomerTierManagerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    const activeTier = tiers.find(t => t.id === currentTierId);

    async function handleSelect(tierId: string) {
        setIsUpdating(true);
        const formData = new FormData();
        formData.append("customerId", customerId);
        formData.append("tierId", tierId);

        await updateCustomerTier(formData);

        setIsUpdating(false);
        setIsOpen(false);
    }

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                disabled={isUpdating}
                className={cn(
                    "flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-medium transition-all w-full md:w-auto justify-between",
                    activeTier
                        ? "bg-neutral-900 border-neutral-700 hover:border-neutral-500"
                        : isMember
                            ? "border-indigo-500/30 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                            : "border-neutral-700 bg-neutral-900/50 text-neutral-400 hover:bg-neutral-800"
                )}
                style={activeTier ? { borderColor: activeTier.color, color: activeTier.color, backgroundColor: `${activeTier.color}10` } : {}}
            >
                <span className="flex items-center gap-2">
                    {activeTier ? (
                        <>
                            <UserCheck className="w-4 h-4" />
                            {activeTier.name} ({activeTier.discount_percentage}% Off)
                        </>
                    ) : isMember ? (
                        <>
                            <UserCheck className="w-4 h-4" />
                            Legacy Member
                        </>
                    ) : (
                        "Assign Membership Type"
                    )}
                </span>
                <ChevronDown className={cn("w-4 h-4 transition-transform", isOpen && "rotate-180")} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-10"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-2 z-20 w-64 rounded-xl border border-white/10 bg-neutral-900 p-2 shadow-xl backdrop-blur-xl">
                        <div className="mb-2 px-2 py-1.5 text-xs font-medium uppercase text-neutral-500">
                            Select Membership Tier
                        </div>

                        <div className="space-y-1">
                            {tiers.map((tier) => (
                                <button
                                    key={tier.id}
                                    onClick={() => handleSelect(tier.id)}
                                    className="w-full flex items-center justify-between rounded-lg px-2 py-2 text-sm text-neutral-200 hover:bg-white/5 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: tier.color }}
                                        />
                                        <span className="font-medium group-hover:text-white">{tier.name}</span>
                                    </div>
                                    <span className="text-xs text-neutral-500">{tier.discount_percentage}% off</span>
                                    {currentTierId === tier.id && <Check className="w-3 h-3 text-emerald-500" />}
                                </button>
                            ))}

                            <div className="my-1 border-t border-white/5" />

                            <button
                                onClick={() => handleSelect("none")}
                                className="w-full flex items-center gap-2 rounded-lg px-2 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                            >
                                <X className="w-4 h-4" />
                                <span>Revoke Membership / No Tier</span>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
