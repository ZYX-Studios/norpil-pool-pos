"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function createTier(formData: FormData) {
    const supabase = createSupabaseServerClient();
    const name = formData.get("name") as string;
    const discount = formData.get("discount");
    const minWallet = formData.get("minWallet");
    const color = formData.get("color") as string;

    const { error } = await supabase.from("membership_tiers").insert({
        name,
        discount_percentage: Number(discount) || 0,
        min_wallet_balance: Number(minWallet) || 0,
        color: color || '#000000'
    });

    if (error) {
        console.error("Error creating tier:", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/customers/tiers");
}

export async function updateTier(formData: FormData) {
    const supabase = createSupabaseServerClient();
    const id = formData.get("id") as string;
    const name = formData.get("name") as string;
    const discount = formData.get("discount");
    const minWallet = formData.get("minWallet");
    const color = formData.get("color") as string;

    const { error } = await supabase.from("membership_tiers").update({
        name,
        discount_percentage: Number(discount) || 0,
        min_wallet_balance: Number(minWallet) || 0,
        color: color || '#000000'
    }).eq("id", id);

    if (error) {
        console.error("Error updating tier:", error);
        throw new Error(error.message);
    }

    revalidatePath("/admin/customers/tiers");
}

export async function deleteTier(formData: FormData) {
    const supabase = createSupabaseServerClient();
    const id = formData.get("id") as string;

    const { error } = await supabase.from("membership_tiers").delete().eq("id", id);

    if (error) {
        console.error("Error deleting tier:", error);
        // Likely foreign key constraint if users are assigned. 
        // For now, let it throw, or handle gracefully.
        throw new Error("Cannot delete tier that is in use.");
    }

    revalidatePath("/admin/customers/tiers");
}
