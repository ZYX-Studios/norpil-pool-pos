import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/auth/actions";

export default async function ProfilePage() {
    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) redirect("/auth/login");

    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

    return (
        <div className="p-6 space-y-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold text-neutral-50">My Profile</h1>

            <div className="flex items-center space-x-4 rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm backdrop-blur">
                <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center text-2xl border border-emerald-500/20">
                    {profile?.full_name?.[0] ?? user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                    <h2 className="font-semibold text-lg text-neutral-50">{profile?.full_name ?? "Guest User"}</h2>
                    <p className="text-sm text-neutral-400">{user.email}</p>
                </div>
            </div>

            <div className="space-y-2">
                <form action={logoutAction}>
                    <button className="w-full bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 h-10 px-4 py-2 rounded-xl font-medium transition-colors">
                        Sign Out
                    </button>
                </form>
            </div>
        </div>
    );
}
