import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { PageHeader } from "../components/AdminComponents";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

import { CustomerTable } from "./CustomerTable";

export default async function CustomersPage() {
    const { staff: currentStaff } = await getCurrentUserWithStaff();
    if (currentStaff?.role !== "ADMIN") redirect("/admin");

    const supabase = createSupabaseServerClient();

    // Fetch ALL profiles (client-side filtering)
    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, is_member, created_at, ranking, wallets(balance)")
        .order("full_name", { ascending: true });

    // Fetch Settings
    const { data: discountSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "member_discount_percentage")
        .single();

    const currentDiscount = Number(discountSetting?.value ?? 0);

    async function saveSettings(formData: FormData) {
        "use server";
        const supabase = createSupabaseServerClient();
        const discount = formData.get("discount");

        await supabase.from("app_settings").upsert({
            key: "member_discount_percentage",
            value: discount?.toString() ?? "0",
            description: "Percentage discount for members (0-100)"
        });

        revalidatePath("/admin/customers");
    }

    async function toggleMembership(formData: FormData) {
        "use server";
        const supabase = createSupabaseServerClient();
        const id = formData.get("id") as string;
        const currentState = formData.get("currentState") === "true";

        await supabase.from("profiles").update({
            is_member: !currentState
        }).eq("id", id);

        revalidatePath("/admin/customers");
    }

    return (
        <div className="space-y-8">
            <PageHeader title="Customers & Membership" description="Manage customer profiles and membership settings." />

            {/* Global Settings Card */}
            <div className="rounded-3xl border border-white/5 bg-neutral-900/50 p-8 shadow-2xl overflow-hidden relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-50" />
                <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <span className="h-6 w-1 bg-indigo-500 rounded-full" />
                        Membership Configuration
                    </h3>
                    <form action={saveSettings} className="flex flex-col gap-6 lg:flex-row lg:items-end">
                        <div className="flex-1">
                            <label className="mb-2 block text-sm font-medium text-neutral-400 uppercase tracking-wider">
                                Member Discount (% off)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="number"
                                    name="discount"
                                    defaultValue={currentDiscount}
                                    min="0"
                                    max="100"
                                    step="any"
                                    className="w-full max-w-[120px] rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-lg font-bold text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                                />
                                <button
                                    type="submit"
                                    className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all"
                                >
                                    Save Changes
                                </button>
                            </div>
                        </div>
                        <p className="max-w-md text-sm text-neutral-400 leading-relaxed bg-white/5 p-4 rounded-xl border border-white/5">
                            This discount is automatically applied to pool table fees for any active member.
                            Use the table below to manually upgrade or revoke membership status.
                        </p>
                    </form>
                </div>
            </div>

            <CustomerTable
                customers={profiles || []}
                toggleMembership={toggleMembership}
            />
        </div>
    );
}
