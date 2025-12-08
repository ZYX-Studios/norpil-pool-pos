import Link from "next/link";

export default function HomePage() {
    return (
        <div className="p-6 space-y-8 max-w-md mx-auto">
            <header className="space-y-2 pt-4">
                <h1 className="text-3xl font-bold tracking-tight text-neutral-50">NORPIL BILLIARDS</h1>
                <p className="text-neutral-400">Your premium billiards experience.</p>
            </header>

            <div className="grid grid-cols-2 gap-4">
                <Link href="/mobile/reservations" className="block group">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col items-center justify-center space-y-3 shadow-sm shadow-black/40 backdrop-blur transition-all hover:bg-white/10 active:scale-95 aspect-square">
                        <span className="text-4xl">🎱</span>
                        <span className="font-semibold text-center text-neutral-50">Reserve Table</span>
                    </div>
                </Link>
                <Link href="/mobile/order" className="block group">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 flex flex-col items-center justify-center space-y-3 shadow-sm shadow-black/40 backdrop-blur transition-all hover:bg-white/10 active:scale-95 aspect-square">
                        <span className="text-4xl">🍔</span>
                        <span className="font-semibold text-center text-neutral-50">Order Food</span>
                    </div>
                </Link>
            </div>

            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 space-y-4 shadow-sm shadow-black/40 backdrop-blur">
                <div className="space-y-1">
                    <h2 className="text-xl font-semibold text-emerald-400">Your Wallet</h2>
                    <p className="text-sm text-emerald-200/70">Top up at the counter to order seamlessly.</p>
                </div>
                <Link href="/mobile/wallet" className="block">
                    <button className="w-full bg-emerald-500 text-white hover:bg-emerald-400 h-10 px-4 py-2 rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20">
                        View Balance
                    </button>
                </Link>
            </div>
        </div>
    );
}
