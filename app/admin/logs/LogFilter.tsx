"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

const ACTION_TYPES = [
    "OPEN_TABLE",
    "CREATE_WALK_IN",
    "UPDATE_CUSTOMER_NAME",
    "PAUSE_SESSION",
    "RESUME_SESSION",
    "RELEASE_TABLE",
    "ADD_ITEM",
    "UPDATE_ITEM_QUANTITY",
    "PAY_ORDER",
    "CREATE_PRODUCT",
    "UPDATE_PRODUCT",
    "TOGGLE_PRODUCT_ACTIVE",
    "DELETE_PRODUCT",
    "CREATE_MANY_PRODUCTS",
    "ADJUST_INVENTORY",
    "ADD_RECIPE_COMPONENT",
    "REMOVE_RECIPE_COMPONENT",
    "UPDATE_STAFF",
    "CREATE_TABLE",
    "UPDATE_TABLE",
    "TOGGLE_TABLE_ACTIVE",
    "DELETE_TABLE",
    "CREATE_EXPENSE",
    "DELETE_EXPENSE",
    "CREATE_INVENTORY_ITEM",
    "UPDATE_INVENTORY_ITEM",
    "DELETE_INVENTORY_ITEM",
    "ADJUST_INVENTORY_ITEM",
    "WALLET_TOPUP",
    "CHECK_IN_RESERVATION",
    "START_SHIFT",
    "END_SHIFT",
    "MEMBERSHIP_UPGRADE",
    "DELETE_ORDER"
] as const;

export default function LogFilter() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const currentAction = searchParams.get("action") || "";
    const currentSearch = searchParams.get("search") || "";
    const [searchValue, setSearchValue] = useState(currentSearch);

    // Sync local state with URL param
    useEffect(() => {
        setSearchValue(currentSearch);
    }, [currentSearch]);

    const handleActionChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams.toString());
        if (value) {
            params.set("action", value);
        } else {
            params.delete("action");
        }
        // Reset page on filter change
        params.set("page", "1");
        router.push(`/admin/logs?${params.toString()}`);
    };

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        if (searchValue) {
            params.set("search", searchValue);
        } else {
            params.delete("search");
        }
        // Reset page on search change
        params.set("page", "1");
        router.push(`/admin/logs?${params.toString()}`);
    };

    return (
        <div className="flex flex-wrap items-center gap-3">
            <form onSubmit={handleSearchSubmit} className="relative">
                <input
                    type="text"
                    placeholder="Search details or ID..."
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 placeholder:text-neutral-500"
                />
            </form>

            <div className="flex items-center gap-2">
                <select
                    value={currentAction}
                    onChange={handleActionChange}
                    className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
                >
                    <option value="" className="bg-neutral-900 text-neutral-400">All Actions</option>
                    {ACTION_TYPES.map((action) => (
                        <option key={action} value={action} className="bg-neutral-900">
                            {action}
                        </option>
                    ))}
                </select>
            </div>
        </div>
    );
}
