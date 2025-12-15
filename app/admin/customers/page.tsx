import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import Link from "next/link";

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
        <div className="space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-50">Customers & Membership</h1>
                    <p className="text-neutral-400">Manage customer profiles and membership settings.</p>
                </div>
            </div>

            {/* Global Settings Card */}
            <div className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur">
                <form action={saveSettings} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-neutral-300">
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
                                className="w-full max-w-[120px] rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-neutral-50 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                            />
                            <button
                                type="submit"
                                className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 active:scale-95"
                            >
                                Save
                            </button>
                        </div>
                    </div>
                    <p className="max-w-md text-xs text-neutral-400">
                        This discount is automatically applied to pool table fees for any active member.
                        Use the table below to manually upgrade or revoke membership status.
                    </p>
                </form>
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

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/5 backdrop-blur">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm text-neutral-400">
                        <thead className="bg-white/5 text-xs uppercase tracking-wider text-neutral-300">
                            <tr>
                                <th className="px-6 py-4 font-medium">Name</th>
                                <th className="px-6 py-4 font-medium">Phone</th>
                                <th className="px-6 py-4 font-medium">Wallet</th>
                                <th className="px-6 py-4 font-medium">Status</th>
                                <th className="px-6 py-4 font-medium text-right">Action</th>
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
