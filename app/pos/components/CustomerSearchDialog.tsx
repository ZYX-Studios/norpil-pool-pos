import { useState, useEffect } from "react";
import { searchCustomers, type CustomerResult } from "../wallet-actions";

type CustomerSearchDialogProps = {
    isOpen: boolean;
    onClose: () => void;
    onSelectCustomer: (customer: CustomerResult) => void;
};

export function CustomerSearchDialog({ isOpen, onClose, onSelectCustomer }: CustomerSearchDialogProps) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<CustomerResult[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!isOpen) {
            setQuery("");
            setResults([]);
        }
    }, [isOpen]);

    useEffect(() => {
        const timer = setTimeout(async () => {
            if (query.length >= 2) {
                setLoading(true);
                try {
                    const data = await searchCustomers(query);
                    setResults(data);
                } catch (err) {
                    console.error("Search failed", err);
                } finally {
                    setLoading(false);
                }
            } else {
                setResults([]);
            }
        }, 500); // Debounce

        return () => clearTimeout(timer);
    }, [query]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="w-full max-w-md rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-neutral-100">Find Customer</h2>
                    <button onClick={onClose} className="text-neutral-400 hover:text-white p-2">✕</button>
                </div>

                <div className="space-y-4">
                    <input
                        type="text"
                        placeholder="Search by name, phone, or email..."
                        className="w-full rounded-xl border border-neutral-700 bg-neutral-800 p-4 text-lg text-white placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        autoFocus
                    />

                    <div className="max-h-64 overflow-y-auto space-y-2">
                        {loading && <div className="text-center text-neutral-500 py-4">Searching...</div>}

                        {!loading && query.length >= 2 && results.length === 0 && (
                            <div className="text-center text-neutral-500 py-4">No customers found.</div>
                        )}

                        {!loading && results.map((customer) => (
                            <button
                                key={customer.id}
                                onClick={() => onSelectCustomer(customer)}
                                className="w-full flex items-center justify-between p-3 rounded-xl hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition"
                            >
                                <div className="flex items-center gap-3 text-left">
                                    <div className="h-10 w-10 rounded-full bg-neutral-700 flex items-center justify-center text-lg font-bold text-neutral-300">
                                        {customer.full_name?.[0]?.toUpperCase() ?? "?"}
                                    </div>
                                    <div>
                                        <p className="font-semibold text-neutral-200">{customer.full_name ?? "Unknown"}</p>
                                        <p className="text-sm text-neutral-400">{customer.phone_number ?? (customer.email ?? "No contact info")}</p>
                                        {customer.email && customer.phone_number && (
                                            <p className="text-xs text-neutral-500">{customer.email}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-xs text-neutral-500">Balance</p>
                                    <p className="font-medium text-emerald-400">₱{customer.wallet?.balance?.toFixed(2) ?? "0.00"}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
