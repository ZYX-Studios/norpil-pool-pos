import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import { PageHeader } from "../components/AdminComponents";

export default async function CustomersPage({
    searchParams
}: {
    searchParams: Promise<{ q?: string }>;
}) {
    const sp = await searchParams;
    const query = sp.q || "";
    const supabase = createSupabaseServerClient();

    // Search profiles
    let profileQuery = supabase
        .from("profiles")
        .select("id, full_name, phone_number, is_member, created_at, wallets(balance)")
        .order("full_name", { ascending: true })
        .limit(50);

    if (query) {
        profileQuery = profileQuery.ilike("full_name", `%${query}%`);
    }

    const { data: profiles, error } = await profileQuery;

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

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-lg font-semibold text-neutral-50">Customer List</h2>
                <form className="flex gap-2">
                    <input
                        type="text"
                        name="q"
                        defaultValue={query}
                        placeholder="Search name..."
                        className="w-full min-w-[250px] rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-neutral-50 focus:border-emerald-500 focus:outline-none"
                    />
                    <button type="submit" className="rounded-xl bg-white/10 px-4 py-2.5 text-sm font-medium text-white hover:bg-white/20">
                        Search
                    </button>
                </form>
            </div>

            <div className="overflow-hidden rounded-3xl border border-white/5 bg-neutral-900/50 shadow-2xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5">
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Name</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Phone</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Wallet</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400">Status</th>
                                <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-neutral-400 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {profiles?.map((profile: any) => (
                                <tr key={profile.id} className="hover:bg-white/5">
                                    <td className="px-6 py-4 font-medium text-neutral-200">
                                        <Link href={`/admin/customers/${profile.id}`} className="hover:text-emerald-400 hover:underline">
                                            {profile.full_name || "Guest"}
                                        </Link>
                                    </td>
                                    <td className="px-6 py-4">
                                        {profile.phone_number || "—"}
                                    </td>
                                    <td className="px-6 py-4 font-mono text-emerald-400">
                                        ₱{Number(profile.wallets?.balance || 0).toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        {profile.is_member ? (
                                            <span className="inline-flex items-center rounded-full bg-indigo-500/20 px-2.5 py-1 text-xs font-medium text-indigo-300 border border-indigo-500/30">
                                                Member
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center rounded-full bg-neutral-500/10 px-2.5 py-1 text-xs font-medium text-neutral-400 border border-neutral-500/20">
                                                Standard
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <form action={toggleMembership} className="inline-block">
                                            <input type="hidden" name="id" value={profile.id} />
                                            <input type="hidden" name="currentState" value={String(profile.is_member)} />
                                            <button
                                                type="submit"
                                                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${profile.is_member
                                                    ? "border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                                                    }`}
                                            >
                                                {profile.is_member ? "Revoke" : "Upgrade"}
                                            </button>
                                        </form>
                                    </td>
                                </tr>
                            ))}
                            {(!profiles || profiles.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-neutral-500">
                                        No customers found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
