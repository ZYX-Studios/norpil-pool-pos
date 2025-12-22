import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

type ActionType =
    | "OPEN_TABLE"
    | "CREATE_WALK_IN"
    | "UPDATE_CUSTOMER_NAME"
    | "PAUSE_SESSION"
    | "RESUME_SESSION"
    | "RELEASE_TABLE"
    | "ADD_ITEM"
    | "UPDATE_ITEM_QUANTITY"
    | "PAY_ORDER"
    | "CREATE_PRODUCT"
    | "UPDATE_PRODUCT"
    | "TOGGLE_PRODUCT_ACTIVE"
    | "DELETE_PRODUCT"
    | "CREATE_MANY_PRODUCTS"
    | "ADJUST_INVENTORY"
    | "ADD_RECIPE_COMPONENT"
    | "REMOVE_RECIPE_COMPONENT"
    | "UPDATE_STAFF"
    | "CREATE_TABLE"
    | "UPDATE_TABLE"
    | "TOGGLE_TABLE_ACTIVE"
    | "DELETE_TABLE"
    | "CREATE_EXPENSE"
    | "DELETE_EXPENSE"
    | "CREATE_INVENTORY_ITEM"
    | "UPDATE_INVENTORY_ITEM"
    | "DELETE_INVENTORY_ITEM"
    | "ADJUST_INVENTORY_ITEM"
    | "WALLET_TOPUP"
    | "CHECK_IN_RESERVATION"
    | "START_SHIFT"
    | "END_SHIFT"
    | "MEMBERSHIP_UPGRADE"
    | "DELETE_ORDER"
    | "VOID_ITEM";

interface LogParams {
    actionType: ActionType;
    entityType?: string;
    entityId?: string;
    details?: Record<string, any>;
}

/**
 * Logs a user action to the database.
 * This is a fire-and-forget operation that shouldn't block the main request.
 */
export async function logAction({ actionType, entityType, entityId, details }: LogParams) {
    try {
        const supabase = createSupabaseServerActionClient();

        // Get current user
        const { data: { user } } = await supabase.auth.getUser();

        // Get request info
        const headersList = await headers();
        const ip = headersList.get("x-forwarded-for") || "unknown";
        const userAgent = headersList.get("user-agent") || "unknown";

        const { error } = await supabase.from("action_logs").insert({
            user_id: user?.id || null,
            action_type: actionType,
            entity_type: entityType,
            entity_id: entityId,
            details,
            ip_address: ip,
            user_agent: userAgent,
        });

        if (error) {
            console.error("Failed to log action:", error);
        }
    } catch (err) {
        console.error("Error in logAction:", err);
    }
}
