import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { PageHeader } from "../components/AdminComponents";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

import { CustomerTable } from "./CustomerTable";

export default async function CustomersPage() {
    const { staff: currentStaff } = await getCurrentUserWithStaff();
    if (currentStaff?.role !== "ADMIN" && currentStaff?.role !== "OWNER") redirect("/admin");

    const supabase = createSupabaseServerClient();

    // Fetch ALL profiles (client-side filtering)
    const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, full_name, phone_number, is_member, membership_number, created_at, ranking, wallets(balance), membership_tiers(name, color, min_wallet_balance)")
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

            <div className="grid gap-6 md:grid-cols-2">
                {/* Global Settings Card (Legacy/Default) */}
                <div className="rounded-3xl border border-white/5 bg-neutral-900/50 p-8 shadow-2xl overflow-hidden relative group">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-50" />
                    <div className="relative z-10">
                        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                            <span className="h-6 w-1 bg-indigo-500 rounded-full" />
                            Default Configuration
                        </h3>
                        <form action={saveSettings} className="flex flex-col gap-4">
                            <div>
                                <label className="mb-2 block text-sm font-medium text-neutral-400 uppercase tracking-wider">
                                    Default Member Discount (% off)
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        name="discount"
                                        defaultValue={currentDiscount}
                                        min="0"
                                        max="100"
                                        step="any"
                                        className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-3 text-lg font-bold text-white focus:border-indigo-500 focus:outline-none transition-all shadow-inner"
                                    />
                                    <button
                                        type="submit"
                                        className="rounded-xl bg-indigo-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-500 active:scale-95 transition-all"
                                    >
                                        Save
                                    </button>
                                </div>
                            </div>
                            <p className="text-xs text-neutral-500 mt-2">
                                Applied to members with no specific tier assigned.
                            </p>
                        </form>
                    </div>
                </div>

                {/* Tiers Management Link */}
                <Link
                    href="/admin/customers/tiers"
                    className="rounded-3xl border border-white/5 bg-neutral-900/50 p-8 shadow-2xl relative group hover:bg-neutral-800/50 transition-all cursor-pointer"
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-teal-500/5 opacity-50 group-hover:opacity-80 transition-opacity" />
                    <div className="relative z-10 h-full flex flex-col justify-between">
                        <div>
                            <h3 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                <span className="h-6 w-1 bg-emerald-500 rounded-full" />
                                Membership Tiers
                            </h3>
                            <p className="text-neutral-400 text-sm">
                                Create and manage membership tiers (Gold, Silver, etc.) with custom discounts and requirements.
                            </p>
                        </div>
                        <div className="mt-6 flex items-center text-emerald-400 font-bold text-sm">
                            Manage Tiers →
                        </div>
                    </div>
                </Link>
            </div>



            <CustomerTable
                customers={profiles?.map(p => ({
                    ...p,
                    membership_tiers: Array.isArray(p.membership_tiers) ? p.membership_tiers[0] : p.membership_tiers
                })) as any || []}
                toggleMembership={toggleMembership}
            />
        </div >
    );
}
