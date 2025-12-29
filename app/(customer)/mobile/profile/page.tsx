import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/auth/actions";
import { ReservationsList } from "@/app/components/ReservationsList";
import { AvatarUpload } from "./components/AvatarUpload";
import { revalidatePath } from "next/cache";
import { ProfileNameEdit } from "./components/ProfileNameEdit";

export default async function ProfilePage() {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: profileData } = await supabase
        .from("profiles")
        .select(`
            *,
            membership_tiers (
                name,
                color,
                min_wallet_balance
            ),
            wallets (
                balance
            )
        `)
        .eq("id", user.id)
        .single();

    // Handle array/object potential mismatch for relations
    const profile = profileData ? {
        ...profileData,
        membership_tiers: Array.isArray(profileData.membership_tiers) ? profileData.membership_tiers[0] : profileData.membership_tiers,
        wallets: Array.isArray(profileData.wallets) ? profileData.wallets[0] : profileData.wallets
    } : null;

    const currentBalance = profile?.wallets?.balance || 0;
    const minBalance = profile?.membership_tiers?.min_wallet_balance || 0;
    const isBelowMinimum = currentBalance < minBalance;

    async function updateProfileName(formData: FormData) {
        "use server";
        const supabase = createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const fullName = formData.get("full_name");
        await supabase.from("profiles")
            .update({ full_name: fullName })
            .eq("id", user.id);

        revalidatePath("/mobile/profile");
        revalidatePath("/mobile/home");
    }

    return (
        <div className="p-6 space-y-6 max-w-md mx-auto pt-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">My Profile</h1>

            {/* Minimum Balance Warning */}
            {isBelowMinimum && profile?.membership_tiers && (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex items-start gap-3">
                    <div className="text-amber-500 mt-0.5">⚠️</div>
                    <div>
                        <h3 className="text-sm font-bold text-amber-500">Membership System Alert</h3>
                        <p className="text-xs text-amber-200/80 mt-1">
                            Your wallet balance is below the minimum required for <strong>{profile.membership_tiers.name}</strong> tier.
                            <br />
                            Please top up to maintain your benefits.
                        </p>
                        <div className="mt-2 text-xs font-mono text-amber-500/80">
                            Required: ₱{minBalance.toLocaleString()}
                        </div>
                    </div>
                </div>
            )}

            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
                <AvatarUpload
                    userId={user.id}
                    currentAvatarUrl={profile?.avatar_url}
                    userName={profile?.full_name ?? user.email ?? "User"}
                />
                <div className="flex-1">
                    <ProfileNameEdit
                        currentName={profile?.full_name ?? ""}
                        updateAction={updateProfileName}
                    />
                    <p className="text-sm text-neutral-400 mt-1">{user.email}</p>

                    <div className="mt-3 flex flex-wrap gap-2">
                        {profile?.membership_tiers ? (
                            <div
                                className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 inline-flex"
                                style={{
                                    borderColor: `${profile.membership_tiers.color}40`,
                                    backgroundColor: `${profile.membership_tiers.color}10`
                                }}
                            >
                                <span
                                    className="text-[10px] font-bold tracking-widest uppercase"
                                    style={{ color: profile.membership_tiers.color }}
                                >
                                    {profile.membership_tiers.name}
                                </span>
                            </div>
                        ) : profile?.is_member && (
                            <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 inline-flex">
                                <span className="text-[10px] font-bold text-white/60 tracking-widest uppercase">Member</span>
                            </div>
                        )}

                        {profile?.membership_number && (
                            <div className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 inline-flex">
                                <span className="text-[10px] font-mono font-bold text-white/40 tracking-[0.15em]">{profile.membership_number}</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="space-y-2">
                <form action={logoutAction}>
                    <button className="w-full bg-white/5 text-neutral-300 border border-white/10 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20 h-11 px-4 py-2 rounded-xl font-semibold transition-all">
                        Sign Out
                    </button>
                </form>
            </div>

            <div className="pt-6 border-t border-white/10">
                <ReservationsList userId={user.id} />
            </div>
        </div>
    );
}
