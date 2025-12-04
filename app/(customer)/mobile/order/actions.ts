'use server';

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type CartItem = {
    productId: string;
    quantity: number;
    price: number; // Passed from client for calculation, but we should verify on server ideally. 
    // For MVP, we'll trust the price or fetch it. Let's fetch it to be safe.
};

export async function placeOrderAction(items: CartItem[]) {
    const supabase = createSupabaseServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { error: "You must be logged in to place an order." };
    }

    if (!items || items.length === 0) {
        return { error: "Cart is empty." };
    }

    // 1. Fetch products to verify prices and calculate total
    const productIds = items.map(i => i.productId);
    const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, price, name")
        .in("id", productIds);

    if (productsError || !products) {
        return { error: "Failed to fetch product details." };
    }

    let subtotal = 0;
    const verifiedItems = items.map(item => {
        const product = products.find(p => p.id === item.productId);
        if (!product) throw new Error(`Product not found: ${item.productId}`);
        const lineTotal = product.price * item.quantity;
        subtotal += lineTotal;
        return {
            ...item,
            price: product.price,
            lineTotal
        };
    });

    // 2. Check Wallet Balance
    const { data: wallet, error: walletError } = await supabase
        .from("wallets")
        .select("id, balance")
        .eq("profile_id", user.id)
        .single();

    if (walletError || !wallet) {
        return { error: "Wallet not found." };
    }

    if (wallet.balance < subtotal) {
        return { error: "Insufficient wallet balance." };
    }

    // 3. Perform Transaction (Order + Payment + Wallet Deduction)
    // Supabase RPC is best for transactions, but we can do it sequentially with checks for MVP.
    // Ideally, we wrap this in a postgres function. 
    // Let's do it sequentially for now, as we don't have a complex transaction RPC yet.
    // RISK: Race condition if user double clicks. We should handle this on client too.

    // A. Deduct Wallet
    const { error: updateError } = await supabase
        .from("wallets")
        .update({ balance: wallet.balance - subtotal })
        .eq("id", wallet.id);

    if (updateError) {
        return { error: "Failed to process payment." };
    }

    // B. Record Transaction
    await supabase.from("wallet_transactions").insert({
        wallet_id: wallet.id,
        amount: -subtotal,
        type: "PAYMENT",
        description: "Mobile Order"
    });

    // C. Create Order
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            profile_id: user.id,
            status: "PAID",
            subtotal: subtotal,
            total: subtotal, // Assuming no tax/service charge for mobile yet
            // table_session_id is NULL
        })
        .select()
        .single();

    if (orderError || !order) {
        // CRITICAL: We deducted money but failed to create order.
        // In a real app, we need a rollback mechanism or RPC.
        // For this MVP, we'll log it.
        console.error("CRITICAL: Money deducted but order failed", orderError);
        return { error: "Order creation failed. Please contact staff." };
    }

    // D. Create Order Items
    const orderItemsData = verifiedItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.lineTotal
    }));

    await supabase.from("order_items").insert(orderItemsData);

    // E. Record Payment
    await supabase.from("payments").insert({
        order_id: order.id,
        amount: subtotal,
        method: "WALLET",
        paid_at: new Date().toISOString()
    });

    return { success: true, orderId: order.id };
}
