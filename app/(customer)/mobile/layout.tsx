import { BottomNav } from "@/app/components/customer/BottomNav";

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="flex flex-col min-h-screen bg-neutral-950 text-neutral-50 pb-16">
            <main className="flex-1 overflow-y-auto">
                {children}
            </main>
            <BottomNav />
        </div>
    );
}
