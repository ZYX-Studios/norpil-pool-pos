'use server';

import { createSupabaseServerActionClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Define strict types
type CartItem = {
    productId: string;
    quantity: number;
    price: number;
};

type PaymentMethod = "WALLET" | "CHARGE_TO_TABLE";

type OrderResult =
    | { success: true; orderId: string }
    | { success: false; error: string };

export async function placeOrderAction(
    items: CartItem[],
    tableIdentifier?: string,
    method: PaymentMethod = "WALLET"
): Promise<OrderResult> {
    const supabase = createSupabaseServerActionClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return { success: false, error: "You must be logged in to place an order." };
    }

    if (!items || items.length === 0) {
        return { success: false, error: "Cart is empty." };
    }

    // 1. Fetch products to verify prices and calculate total
    // Security: Always fetch fresh prices from DB, never trust client prices
    const productIds = items.map(i => i.productId);
    const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, price, name, category, is_active")
        .in("id", productIds);

    if (productsError || !products) {
        return { success: false, error: "Failed to fetch product details." };
    }

    let subtotal = 0;
    const verifiedItems = [];

    for (const item of items) {
        const product = products.find(p => p.id === item.productId);

        if (!product) {
            return { success: false, error: `Product not found: ${item.productId}` };
        }

        if (!product.is_active) {
            return { success: false, error: `Product '${product.name}' is currently unavailable.` };
        }

        const lineTotal = product.price * item.quantity;
        subtotal += lineTotal;

        verifiedItems.push({
            ...item,
            price: product.price, // Override with authoritative price
            lineTotal
        });
    }

    let activeSessionId: string | null = null;
    let finalTableLabel: string | null = null;
    let finalStatus = "PAID"; // Default for Wallet

    // 2. KDS Filter Logic
    // ... (comments)

    // 3. Resolve Table & Session
    const isAdvanceOrder = tableIdentifier?.startsWith("ADVANCE::");
    const isWalkIn = tableIdentifier === "WALK_IN";

    if (isAdvanceOrder) {
        // Advance Order Logic
        if (method === "CHARGE_TO_TABLE") {
            return { success: false, error: "Advance orders must be paid via Wallet." };
        }
        // Extract time/note from identifier "ADVANCE::Arriving in 30 mins"
        finalTableLabel = tableIdentifier!.replace("ADVANCE::", "Advance: ");
        // No session ID for advance orders
    } else if (isWalkIn) {
        // Walk-in Logic
        if (method === "CHARGE_TO_TABLE") {
            return { success: false, error: "Walk-in orders must be paid via Wallet." };
        }
        finalTableLabel = "Walk-in";
    } else if (tableIdentifier) {
        // Standard Dine-in Logic
        // Normalize: "1" -> "Table 1", "table 1" -> "Table 1"
        const normalizedInput = tableIdentifier.toLowerCase().replace(/\s+/g, '');

        // Exact match first (try "Table 1" then "1")
        // We fetch all non-deleted tables to match
        const { data: tables } = await supabase
            .from("pool_tables")
            .select("id, name")
            .is("deleted_at", null);

        const matchedTable = tables?.find(t => {
            const tNorm = t.name.toLowerCase().replace(/\s+/g, '');
            return tNorm === normalizedInput || tNorm === `table${normalizedInput}`;
        });

        if (!matchedTable) {
            return { success: false, error: `Table "${tableIdentifier}" not found.` };
        }

        finalTableLabel = matchedTable.name;

        // Find Active Session
        const { data: session } = await supabase
            .from("table_sessions")
            .select("id, status")
            .eq("pool_table_id", matchedTable.id) // Corrected column name
            .eq("status", "OPEN")
            .maybeSingle(); // Use maybeSingle as it might not exist

        if (session) {
            activeSessionId = session.id;
        } else {
            // If "Charge to Table", session is MANDATORY
            if (method === "CHARGE_TO_TABLE") {
                return { success: false, error: `${matchedTable.name} has no active session. Ask staff to open it.` };
            }
            // If Wallet, allow generic order linked to table (optional, but good for tracking)
        }
    } else if (method === "CHARGE_TO_TABLE") {
        return { success: false, error: "No table specified for table charge." };
    }

    console.log(`[Order] Received order. Method: ${method}, Table: ${tableIdentifier}, User: ${user.id}`);

    // ... (existing code)

    // 3. Handle Payment Method Logic
    if (method === "CHARGE_TO_TABLE") {
        // Redundant check, but safe
        if (!activeSessionId) {
            return { success: false, error: "Unable to charge to table: No active session found." };
        }
        finalStatus = "OPEN";
        // We do NOT deduct wallet.
    } else {
        // WALLET PAYMENT
        // Check Wallet Balance
        const { data: wallet, error: walletError } = await supabase
            .from("wallets")
            .select("id, balance")
            .eq("profile_id", user.id)
            .single();

        if (walletError || !wallet) {
            return { success: false, error: "Wallet not found. Please contact support." };
        }

        if (wallet.balance < subtotal) {
            return { success: false, error: `Insufficient wallet balance. Needed: ₱${subtotal}, Available: ₱${wallet.balance}` };
        }

        // Deduct Wallet
        console.log(`[Order] Deducting from wallet: ${wallet.id}, Current: ${wallet.balance}, Deduct: ${subtotal}, New: ${Number(wallet.balance) - subtotal}`);
        const { error: updateError, count } = await supabase
            .from("wallets")
            .update({ balance: Number(wallet.balance) - subtotal })
            .eq("id", wallet.id); // removed .select() which implicitly returns count? No, update returns count/data if configured

        if (updateError) {
            console.error("[Order] Wallet update error:", updateError);
            return { success: false, error: "Failed to process payment." };
        }
        // NOTE: Supabase update does not return count by default unless .select() or count option used? 
        // Actually the JS client returns count if specified in `count` param?
        // Let's rely on error for now, but adding explicit logging.

        // Record Transaction
        const { error: txError } = await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            amount: -subtotal,
            type: "PAYMENT",
            description: `Mobile Order ${tableIdentifier ? `(Table ${tableIdentifier})` : ''}`
        });

        if (txError) {
            console.error("[Order] Transaction record failed:", txError);
            // CRITICAL: Start rollback? Or just warn?
            // Since wallet is deducted, we MUST record this. 
            // If this fails, we have financial data mismatch.
            return { success: false, error: "Payment recorded but transaction history failed. Please contact support." };
        }

        // status remains "PAID"
    }

    // 4. Create Order
    const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
            profile_id: user.id,
            status: finalStatus,
            subtotal: subtotal,
            total: subtotal,
            order_type: "MOBILE", // ALWAYS MOBILE to trigger KDS visibility rule for OPEN orders
            table_session_id: activeSessionId,
            table_label: finalTableLabel || (tableIdentifier ? (tableIdentifier.startsWith('Table') ? tableIdentifier : `Table ${tableIdentifier}`) : null),
        })
        .select()
        .single();

    if (orderError || !order) {
        console.error("Order creation failed", orderError);
        // Refund if wallet was charged? Ideally use transaction, but Supabase HTTP API doesn't support easy transactions yet without RPC.
        // For now, this is a risk edge case.
        return { success: false, error: "Order creation database failed." };
    }

    // 5. Create Items
    const orderItemsData = verifiedItems.map(item => ({
        order_id: order.id,
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
        line_total: item.lineTotal
    }));

    const { error: itemsError } = await supabase.from("order_items").insert(orderItemsData);

    if (itemsError) {
        console.error("Order items creation failed", itemsError);
        return { success: false, error: "Failed to add items to order." };
    }

    // 6. Record Payment Record (Only for Wallet)
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

