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

    return (
        <Suspense fallback={<div className="p-6 text-center text-neutral-400">Loading order...</div>}>
            <OrderPageClient products={products || []} />
        </Suspense>
    );
}
