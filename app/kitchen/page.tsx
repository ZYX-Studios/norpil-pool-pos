import { KitchenBoard } from "@/app/pos/components/KitchenBoard";
import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export default async function KitchenPage() {
    const { staff } = await getCurrentUserWithStaff();

    // Optional: Protect route for Kitchen/Admin/Waiter roles
    // For now, allow any staff
    if (!staff) {
        redirect("/auth/login");
    }

    return (
        <div className="min-h-screen bg-neutral-950 text-neutral-50 p-6">
            <KitchenBoard />
        </div>
    );
}
