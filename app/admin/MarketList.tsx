import { createSupabaseServerClient } from "@/lib/supabase/server";
import { MarketListModal } from "./MarketListModal";

export async function MarketList() {
    const supabase = createSupabaseServerClient();

    // Fetch inventory items and stock levels
    const { data: itemRows } = await supabase
        .from("inventory_items")
        .select("id, name, unit, min_stock, max_stock")
        .eq("is_active", true)
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

    const lowStockItems: any[] = [];
    const restockItems: any[] = [];
    let trackedItemCount = 0;

    itemRows?.forEach((item: any) => {
        const currentStock = stockMap.get(item.id) ?? 0;
        const minStock = Number(item.min_stock ?? 0);
        const maxStock = Number(item.max_stock ?? 0);

        // Skip if max_stock is not set (assumed 0 means no limit/tracking for restocking)
        if (maxStock <= 0) return;

        trackedItemCount++;

        const amountNeeded = maxStock - currentStock;
        if (amountNeeded <= 0) return;

        const marketItem = {
            ...item,
            currentStock,
            amountNeeded,
        };

        if (currentStock < minStock) {
            lowStockItems.push(marketItem);
        } else {
            restockItems.push(marketItem);
        }
    });

    return (
        <MarketListModal
            lowStockItems={lowStockItems}
            restockItems={restockItems}
            trackedItemCount={trackedItemCount}
        />
    );
}
