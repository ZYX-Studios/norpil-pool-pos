"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function updateCustomerTier(formData: FormData) {
    const supabase = createSupabaseServerClient();
    const customerId = formData.get("customerId") as string;
    const tierId = formData.get("tierId") as string;

    // If tierId is empty/null, it means "No Tier".
    // We should also probably set is_member to true if a tier is selected, or false if not?
    // The plan said: "Legacy Compatibility: is_member... will be kept as fallbacks".
    // So if a tier is selected, is_member should be true.

    if (!tierId || tierId === "none") {
        await supabase.from("profiles").update({
            membership_tier_id: null,
            is_member: false // Revoke legacy status too if removing tier? Or just let them be "regular" member?
            // "Regular" member implies they have "is_member: true" but no tier.
            // But the dropdown will likely have "No Membership" which implies neither.
        }).eq("id", customerId);
    } else {
        await supabase.from("profiles").update({
            membership_tier_id: tierId,
            is_member: true // Ensure they are marked as member
        }).eq("id", customerId);
    }

    revalidatePath(`/admin/customers/${customerId}`);
}
