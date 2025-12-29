import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";
import { PageHeader } from "../../components/AdminComponents";
import { TierList } from "./TierList";
import Link from "next/link";

export default async function MembershipTiersPage() {
    const { staff: currentStaff } = await getCurrentUserWithStaff();
    if (currentStaff?.role !== "ADMIN" && currentStaff?.role !== "OWNER") redirect("/admin");

    const supabase = createSupabaseServerClient();
    const { data: tiers } = await supabase
        .from("membership_tiers")
        .select("*")
        .order("min_wallet_balance", { ascending: true });

    return (
        <div className="space-y-8">
            <div>
                <Link href="/admin/customers" className="mb-2 inline-block text-xs font-medium text-neutral-500 hover:text-white">
                    ← Back to Customers
                </Link>
                <PageHeader
                    title="Membership Tiers"
                    description="Configure membership levels, discounts, and requirements."
                />
            </div>

            <div className="p-6 rounded-3xl border border-white/5 bg-neutral-900/50 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-50 pointer-events-none" />
                <div className="relative z-10">
                    <p className="mb-6 text-sm text-neutral-400 max-w-2xl">
                        Define different membership tiers here. Customers assigned to a tier will automatically receive the specified discount on table fees. The minimum wallet balance is a guideline for staff.
                    </p>
                    <TierList tiers={tiers || []} />
                </div>
            </div>
        </div>
    );
}
