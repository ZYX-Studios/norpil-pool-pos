import { useState } from "react";
import { topUpWallet, type CustomerResult } from "../wallet-actions";

type WalletTopUpDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    customer: CustomerResult | null;
};

export function WalletTopUpDialog({ isOpen, onClose, customer }: WalletTopUpDialogProps) {
    const [amount, setAmount] = useState<string>("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    if (!isOpen || !customer) return null;

    const handleTopUp = async () => {
        if (!customer.wallet?.id) {
            setError("This customer doesn't have a wallet configured.");
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setError("Please enter a valid amount.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const res = await topUpWallet(customer.wallet.id, numericAmount);
            if (res.success) {
                setSuccess(true);
                setTimeout(() => {
                    onClose();
                    setSuccess(false);
                    setAmount("");
                }, 1500);
            } else {
                setError(res.error || "Top up failed.");
            }
        } catch (err) {
            setError("An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const quickAmounts = [100, 200, 500, 1000];

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-xl">
                {success ? (
                    <div className="flex flex-col items-center justify-center py-8 space-y-4">
                        <div className="h-16 w-16 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-bold text-white">Top Up Successful!</h3>
                        <p className="text-neutral-400">Added ₱{amount} to {customer.full_name}&apos;s wallet.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-neutral-100">Top Up Wallet</h2>
                                <p className="text-sm text-neutral-400">for {customer.full_name}</p>
                            </div>
                            <button onClick={onClose} className="text-neutral-400 hover:text-white p-2">✕</button>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center justify-between rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
                                <span className="text-emerald-200">Current Balance</span>
                                <span className="text-xl font-bold text-emerald-400">₱{customer.wallet?.balance?.toFixed(2) ?? "0.00"}</span>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-neutral-300">Amount</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 font-bold text-lg">₱</span>
                                    <input
                                        type="number"
                                        placeholder="0.00"
                                        className="w-full rounded-xl border border-neutral-700 bg-neutral-800 pl-10 pr-4 py-4 text-2xl font-bold text-white placeholder-neutral-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-4 gap-2">
                                {quickAmounts.map((amt) => (
                                    <button
                                        key={amt}
                                        onClick={() => setAmount(amt.toString())}
                                        className="rounded-lg bg-neutral-800 py-2 text-sm font-medium text-neutral-300 hover:bg-neutral-700 transition"
                                    >
                                        +{amt}
                                    </button>
                                ))}
                            </div>

                            {error && (
                                <div className="rounded-lg bg-rose-500/10 p-3 text-sm text-rose-400 text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                onClick={handleTopUp}
                                disabled={loading}
                                className="w-full rounded-xl bg-emerald-500 py-4 font-bold text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-400 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition"
                            >
                                {loading ? "Processing..." : "Confirm Top Up"}
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
