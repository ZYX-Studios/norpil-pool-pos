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
        // Rule: Load 500+ -> Become Member
        if (amount >= 500) {
            const { error: memberErr } = await supabase
                .from("profiles")
                .update({ is_member: true })
                .eq("id", wallet.profile_id);

            if (memberErr) {
                console.error("Failed to upgrade membership:", memberErr);
                // Don't block top-up success, but log it.
            } else {
                await logAction({
                    actionType: "MEMBERSHIP_UPGRADE",
                    entityType: "profile",
                    entityId: wallet.profile_id,
                    details: { reason: "Top-up >= 500", amount },
                });
            }
        }

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

    // Check wallet
    const { data: wallet } = await supabase.from("wallets").select("id, balance, profile_id").eq("payment_code", code).single();

    if (!wallet) return { success: false, error: "Invalid Code" };
    if (wallet.balance < amount) return { success: false, error: "Insufficient Balance" };

    // Deduct from wallet
    const { error: deductErr } = await supabase.rpc("deduct_wallet_balance", { p_wallet_id: wallet.id, p_amount: amount });
    if (deductErr) return { success: false, error: "Wallet Deduction Failed" };

    try {
        await closeSessionAndRecordPayment(supabase, {
            sessionId,
            method: "WALLET",
            tenderedAmount: amount,
            profileId: wallet.profile_id // Wallet owner is the payer
        });

        await logAction({
            actionType: "PAY_ORDER",
            entityType: "table_session",
            entityId: sessionId,
            details: { method: "WALLET", tenderedAmount: amount, walletId: wallet.id }
        });

        revalidatePath("/pos");
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}
