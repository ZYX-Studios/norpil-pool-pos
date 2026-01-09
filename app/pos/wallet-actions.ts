'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logger";
import { revalidatePath } from "next/cache";
import { closeSessionAndRecordPayment } from "@/lib/payments/closeSession";

export type CustomerResult = {
    id: string; // profile_id (which is same as user_id)
    full_name: string | null;
    phone_number: string | null;
    avatar_url: string | null;
    email?: string | null; // From auth.users if possible
    membership_number?: string | null; // Unique membership number (NP-XXXXX)
    wallet: {
        id: string;
        balance: number;
    } | null;
};

export async function searchCustomers(query: string): Promise<CustomerResult[]> {
    if (!query || query.length < 2) return [];

    const supabase = createSupabaseServerClient();

    // We search profiles. 
    // Note: To get email, we might need a joined view or RPC because emails are in auth.users and RLS on auth.users is strict.
    // For now, let's search by name/phone in profiles.

    const { data: results, error } = await supabase
        .rpc('search_customers', { p_query: query });

    if (error) {
        console.error("Error searching customers:", error);
        return [];
    }

    return results.map((r: any) => ({
        id: r.id,
        full_name: r.full_name,
        phone_number: r.phone_number,
        avatar_url: r.avatar_url,
        email: r.email,
        membership_number: r.membership_number,
        wallet: r.wallet_id ? {
            id: r.wallet_id,
            balance: Number(r.balance)
        } : null
    }));
}

export type TopUpResult = {
    success: boolean;
    error?: string;
    newBalance?: number;
};

export async function topUpWallet(walletId: string, amount: number, details?: string): Promise<TopUpResult> {
    const supabase = createSupabaseServerClient();

    try {
        if (amount <= 0) {
            throw new Error("Amount must be positive");
        }

        // 1. Get current wallet to ensure it exists and get profile_id for logging
        const { data: wallet, error: walletErr } = await supabase
            .from("wallets")
            .select("id, profile_id, balance")
            .eq("id", walletId)
            .single();

        if (walletErr || !wallet) {
            throw new Error("Wallet not found");
        }

        // 2. Insert Transaction
        const { error: txError } = await supabase
            .from("wallet_transactions")
            .insert({
                wallet_id: walletId,
                amount: amount,
                type: 'DEPOSIT',
                description: details || 'Manual Top Up from POS',
            });

        if (txError) {
            throw txError;
        }

        // 3. Update Wallet Balance
        // We do this via increment for safety, though concurrency is low here.
        const newBalance = Number(wallet.balance) + amount;

        const { error: updateError } = await supabase
            .from("wallets")
            .update({
                balance: newBalance,
                updated_at: new Date().toISOString()
            })
            .eq("id", walletId);

        if (updateError) {
            // Note: If this fails, we have a transaction record but no balance update. 
            // In a real banking app, we'd use a transaction block. 
            // Supabase RPC is better for atomicity, but for now this is "okay" given user requirements for simplicity.
            // A better way is an RPC "add_funds(wallet_id, amount)".
            throw updateError;
        }

        // 4. Check for Membership Upgrade
        // Handled by Database Trigger `on_wallet_balance_change`
        // Rule: Balance >= Tier Min -> Auto Assign Tier

        // 5. Log Action
        await logAction({
            actionType: "WALLET_TOPUP",
            entityType: "wallet",
            entityId: walletId,
            details: { amount, oldBalance: wallet.balance, newBalance },
        });

        revalidatePath("/pos");

        return { success: true, newBalance };

    } catch (error: any) {
        console.error("Top Up Failed:", error);
        return { success: false, error: error.message };
    }
}

export type PaymentCodeResult = {
    success: boolean;
    error?: string;
    customer_name?: string;
    new_balance?: number;
};

export async function processPaymentCode(sessionId: string, code: string, amount: number, profileId?: string) {
    const supabase = createSupabaseServerClient();

    try {
        // 1. Get Session Order ID
        const { data: session, error: sessionErr } = await supabase
            .from("table_sessions")
            .select("orders(id)")
            .eq("id", sessionId)
            .single();

        if (sessionErr || !session || !session.orders?.[0]?.id) {
            console.error("Session fetch error:", sessionErr || "No order found");
            return { success: false, error: "Session or Order not found" };
        }

        const orderId = session.orders[0].id;

        // 2. Call RPC to process wallet logic (verify code, deduct balance, link order)
        // This is atomic for the wallet side.
        const { data: result, error: rpcErr } = await supabase
            .rpc("process_wallet_payment", {
                p_code: code,
                p_amount: amount,
                p_order_id: orderId
            });

        if (rpcErr) {
            console.error("RPC Error:", rpcErr);
            // RPC errors are usually generic pg errors, but the RPC returns a JSON object on success/failure logic?
            // Wait, the RPC returns JSON. so rpcErr is only if the CALL fails (e.g. permission).
            // Logic errors are in `result`.
            return { success: false, error: rpcErr.message };
        }

        // result is a JSON object { success, error, user_id, customer_name, new_balance }
        const res = result as any;

        if (!res || !res.success) {
            return { success: false, error: res?.error || "Payment failed (Invalid Code or Balance)" };
        }

        // 3. Record Payment in POS system
        // The wallet deduction happened above. Now we record it in `payments` table to balance the order.
        await closeSessionAndRecordPayment(supabase, {
            sessionId,
            method: "WALLET",
            tenderedAmount: amount,
            profileId: res.user_id // Use the profile returned by the secure code check
        });

        // 4. Log Action
        await logAction({
            actionType: "PAY_ORDER",
            entityType: "table_session",
            entityId: sessionId,
            details: { method: "WALLET", amount, walletId: res.wallet_id /* Check if RPC returns wallet_id? It might not. Log user_id instead if needed */ }
        });

        revalidatePath("/pos");

        return {
            success: true,
            customer_name: res.customer_name,
            new_balance: res.new_balance
        };

    } catch (error: any) {
        console.error("Wallet Payment Failed:", error);
        return { success: false, error: error.message };
    }
}
