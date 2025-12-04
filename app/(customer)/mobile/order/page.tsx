import { createSupabaseServerClient } from "@/lib/supabase/server";
import OrderPageClient from "./OrderPageClient";

export default async function OrderPage() {
    const supabase = createSupabaseServerClient();

    const { data: products } = await supabase
        .from("products")
        .select("id, name, price, category")
        .eq("is_active", true)
        .order("name");

    return <OrderPageClient products={products || []} />;
}
