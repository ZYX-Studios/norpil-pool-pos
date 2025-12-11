'use server';

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type CartItem = {
    productId: string;
    quantity: number;
    price: number; // Passed from client for calculation, but we should verify on server ideally. 
    // For MVP, we'll trust the price or fetch it. Let's fetch it to be safe.
};

type PaymentMethod = "WALLET" | "CHARGE_TO_TABLE";

export async function placeOrderAction(items: CartItem[], tableIdentifier?: string, method: PaymentMethod = "WALLET") {
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
        .select("id, price, name, category")
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

    let activeSessionId: string | null = null;
    let finalStatus = "PAID";
    let finalOrderType = "MOBILE"; // Default

    // 2. Resolve Table Session if needed
    if (tableIdentifier) {
        // Normalize: "1" -> "Table 1", "Table 1" -> "Table 1"
        // Try exact match first, then with "Table " prefix
        const possibleNames = [tableIdentifier, `Table ${tableIdentifier}`];

        const { data: tables } = await supabase
            .from("pool_tables")
            .select("id, name")
            .in("name", possibleNames)
            .limit(1);

        const table = tables?.[0];

        if (table) {
            // Check for OPEN session
            const { data: session } = await supabase
                .from("table_sessions")
                .select("id")
                .eq("pool_table_id", table.id)
                .eq("status", "OPEN")
                .single();

            if (session) {
                activeSessionId = session.id;
            }
        }
    }

    // 3. Handle Payment Method Logic
    if (method === "CHARGE_TO_TABLE") {
        if (!activeSessionId) {
            return { error: "No active session found for this table. Please ask staff to open the table or pay upfront." };
        }
        finalStatus = "OPEN";
        finalOrderType = "SESSION"; // It acts like a session order now
        // No wallet deduction
    } else {
        // WALLET PAYMENT
        // Check Wallet Balance
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

        // Deduct Wallet
        const { error: updateError } = await supabase
            .from("wallets")
            .update({ balance: wallet.balance - subtotal })
            .eq("id", wallet.id);

        if (updateError) {
            return { error: "Failed to process payment." };
        }

        // Record Transaction
        await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            amount: -subtotal,
            type: "PAYMENT",
            description: "Mobile Order"
        });

        // Ensure paid record
        // We do this later
    }

    // 4. Create Order
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            profile_id: user.id,
            status: finalStatus,
            subtotal: subtotal,
            total: subtotal,
            order_type: "MOBILE", // Keep as MOBILE to distinguish source, even if charged to table?
            // User plan said: "Order type: SESSION (POS-initiated) vs MOBILE".
            // If charged to table, should it show on KDS? YES.
            // If I set to SESSION, does it break KDS filter?
            // KDS filters: PAID, PREPARING, READY.
            // If status is OPEN, KDS usually ignores it (POS orders are OPEN).
            // BUT User wants Mobile Orders to go to KDS.
            // So we should keep order_type = MOBILE (or verify KDS query).
            // KDS Query: .in("status", ["PAID", "PREPARING", "READY"])
            // !! PROBLEM: If we set status to OPEN (charged to table), KDS won't see it!
            // We need to update KDS to include OPEN orders IF they are type MOBILE.
            table_session_id: activeSessionId, // Link if exists
            table_label: tableIdentifier || null,
        })
        .select()
        .single();

    if (orderError || !order) {
        console.error("Order creation failed", orderError);
        return { error: "Order creation failed." };
    }

    // 5. Create Items
    const orderItemsData = verifiedItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.lineTotal
    }));

    await supabase.from("order_items").insert(orderItemsData);

    // 6. Record Payment (Only for Wallet)
    if (method === "WALLET") {
        await supabase.from("payments").insert({
            order_id: order.id,
            amount: subtotal,
            method: "WALLET",
            paid_at: new Date().toISOString()
        });
    }

    return { success: true, orderId: order.id };
}
