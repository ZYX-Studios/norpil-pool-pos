import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { logoutAction } from "@/app/auth/actions";
import { ReservationsList } from "@/app/components/ReservationsList";

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
        <div className="p-6 space-y-6 max-w-md mx-auto pt-8">
            <h1 className="text-2xl font-bold tracking-tight text-white">My Profile</h1>

            <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] p-5 shadow-lg shadow-black/20 backdrop-blur-sm">
                <div className="w-16 h-16 bg-white/10 border border-white/20 text-white rounded-full flex items-center justify-center text-2xl font-bold shadow-inner">
                    {profile?.full_name?.[0] ?? user.email?.[0]?.toUpperCase() ?? "U"}
                </div>
                <div>
                    <h2 className="font-bold text-lg text-white">{profile?.full_name ?? "Guest User"}</h2>
                    <p className="text-sm text-neutral-400">{user.email}</p>
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
