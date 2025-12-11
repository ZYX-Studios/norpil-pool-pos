
export async function markOrderServedAction(orderId: string) {
    const supabase = createSupabaseServerClient();

    // 1. Get all items for this order
    const { data: items, error: fetchError } = await supabase
        .from("order_items")
        .select("id, quantity")
        .eq("order_id", orderId);

    if (fetchError) throw fetchError;

    // 2. Update served_quantity = quantity for each item
    // We can do this with a single update if we just want to say "everything currently here is served"
    // However, SQL doesn't easily support "update served_quantity = quantity" (set col = other_col) in simple Supabase/PostgREST JS SDK without RPC or raw SQL.
    // But we can iterate. Or we can use RPC if we had one.
    // Actually, we can assume we want to mark ALL as served.

    // Let's iterate for safety and correctness with the JS SDK.
    // Optimization: Promise.all
    if (items && items.length > 0) {
        const updates = items.map(item =>
            supabase
                .from("order_items")
                .update({ served_quantity: item.quantity })
                .eq("id", item.id)
        );
        await Promise.all(updates);
    }

    // 3. Update Order Status
    const { error: updateError } = await supabase
        .from("orders")
        .update({ status: "SERVED" })
        .eq("id", orderId);

    if (updateError) throw updateError;

    revalidatePath("/kitchen");
    revalidatePath("/pos");
}
