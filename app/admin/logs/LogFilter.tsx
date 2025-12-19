"use client";

import { useRouter, useSearchParams } from "next/navigation";

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

    const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const value = e.target.value;
        const params = new URLSearchParams(searchParams);
        if (value) {
            params.set("action", value);
        } else {
            params.delete("action");
        }
        router.push(`/admin/logs?${params.toString()}`);
    };

    return (
        <div className="flex items-center gap-2">
            <span className="text-sm text-neutral-400">Filter by Action:</span>
            <select
                value={currentAction}
                onChange={handleChange}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50"
            >
                <option value="">All Actions</option>
                {ACTION_TYPES.map((action) => (
                    <option key={action} value={action}>
                        {action}
                    </option>
                ))}
            </select>
        </div>
    );
}
