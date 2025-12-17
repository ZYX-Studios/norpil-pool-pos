import { createSupabaseServerClient } from "@/lib/supabase/server";
import OrderPageClient from "./OrderPageClient";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function OrderPage() {
    const supabase = createSupabaseServerClient();

    const { data: products } = await supabase
        .from("products")
        .select("id, name, price, category")
        .eq("is_active", true)
        .order("name");

    const { data: stockRows } = await supabase
        .from("product_stock")
        .select("product_id, quantity_on_hand");

    const stockMap = new Map<string, number>();
    stockRows?.forEach((row: any) => {
        stockMap.set(row.product_id, row.quantity_on_hand ?? 0);
    });

    const productsWithStock = products?.map(p => ({
        ...p,
        stock: stockMap.get(p.id) ?? 0
    })) || [];

    return (
        <Suspense fallback={<div className="p-6 text-center text-neutral-400">Loading order...</div>}>
            <OrderPageClient products={productsWithStock} />
        </Suspense>
    );
}
