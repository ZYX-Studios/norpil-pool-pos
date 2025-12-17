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

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

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
                    {profile?.membership_number && (
                        <div className="mt-2">
                            <span className="text-sm font-mono text-neutral-400 tracking-[0.2em]">
                                {profile.membership_number}
                            </span>
                        </div>
                    )}
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
