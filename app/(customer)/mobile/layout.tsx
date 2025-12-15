import { BottomNav } from "@/app/components/customer/BottomNav";

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <div className="relative flex flex-col min-h-screen bg-[#0a0a0a] text-neutral-50 pb-safe-offset-16">
            {/* Background Ambient Effects */}
            <div className="fixed inset-0 z-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-20%] w-[70vw] h-[70vw] bg-emerald-900/20 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-20%] w-[70vw] h-[70vw] bg-indigo-900/20 rounded-full blur-[100px] mix-blend-screen animate-pulse-slow delay-1000" />
            </div>

            <main className="relative z-10 flex-1 overflow-y-auto pb-20">
                {children}
            </main>

            <div className="relative z-20">
                <BottomNav />
            </div>
        </div>
    );
}
