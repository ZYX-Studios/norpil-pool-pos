'use client';

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { Modal } from "@/app/components/ui/Modal";
import { getOrderDetails } from "./actions";
import { Loader2, User, CreditCard, Tag, Wallet, ArrowDownLeft, ArrowUpRight } from "lucide-react";

type TransactionType = 'PAYMENT' | 'TOPUP';

interface TransactionDetailsModalProps {
    transaction: {
        id: string;
        type: TransactionType;
        reference_id: string | null;
        amount: number;
        description: string;
        created_at: string;
        method: string;
        customer_name: string;
    } | null;
    onClose: () => void;
}

export function TransactionDetailsModal({ transaction, onClose }: TransactionDetailsModalProps) {
    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<any | null>(null);

    useEffect(() => {
        if (transaction?.type === 'PAYMENT' && transaction.reference_id) {
            setTimeout(() => setLoading(true), 0);
            getOrderDetails(transaction.reference_id)
                .then(res => {
                    if (res.success) setOrder(res.order);
                })
                .finally(() => setLoading(false));
        } else {
            setTimeout(() => setOrder(null), 0);
        }
    }, [transaction]);

    if (!transaction) return null;

    return (
        <Modal
            isOpen={!!transaction}
            onClose={onClose}
            title={transaction.type === 'PAYMENT' ? "Payment Details" : "Top-up Details"}
            description={`Transaction ID: ${transaction.id.slice(0, 8)} • ${format(new Date(transaction.created_at), "PPP p")}`}
        >
            <div className="space-y-6">

                {/* Common Transaction Info */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-wider">
                            <User className="w-3.5 h-3.5" /> Customer
                        </div>
                        <div className="text-white font-medium">{transaction.customer_name}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-wider">
                            <CreditCard className="w-3.5 h-3.5" /> Method
                        </div>
                        <div className="text-white font-medium uppercase">{transaction.method}</div>
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-wider">
                            <Tag className="w-3.5 h-3.5" /> Type
                        </div>
                        {transaction.type === 'PAYMENT' ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-400 font-medium">
                                <ArrowDownLeft className="h-3.5 w-3.5" /> Payment
                            </span>
                        ) : (
                            <span className="inline-flex items-center gap-1.5 text-indigo-400 font-medium">
                                <ArrowUpRight className="h-3.5 w-3.5" /> Top-up
                            </span>
                        )}
                    </div>

                    <div className="bg-white/5 p-3 rounded-xl border border-white/5 space-y-1">
                        <div className="flex items-center gap-2 text-neutral-400 text-xs font-medium uppercase tracking-wider">
                            <Wallet className="w-3.5 h-3.5" /> Amount
                        </div>
                        <div className={`text-lg font-bold ${transaction.type === 'PAYMENT' ? 'text-emerald-400' : 'text-indigo-400'}`}>
                            ₱{transaction.amount.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Additional Details based on Type */}
                {transaction.type === 'TOPUP' && (
                    <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                        <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wider mb-2">Description</h3>
                        <p className="text-neutral-200 text-sm">{transaction.description}</p>
                    </div>
                )}

                {transaction.type === 'PAYMENT' && (
                    <div className="space-y-3">
                        <h3 className="text-sm font-medium text-neutral-400 uppercase tracking-wider flex items-center gap-2">
                            Order Items
                            {loading && <Loader2 className="w-3 h-3 animate-spin" />}
                        </h3>

                        {loading ? (
                            <div className="p-8 text-center text-neutral-500 text-xs">Loading order details...</div>
                        ) : order ? (
                            <div className="bg-black/40 rounded-xl border border-white/10 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-white/5 text-neutral-400 font-medium">
                                        <tr>
                                            <th className="px-4 py-2">Item</th>
                                            <th className="px-4 py-2 text-right">Qty</th>
                                            <th className="px-4 py-2 text-right">Price</th>
                                            <th className="px-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {order.order_items?.map((item: any) => (
                                            <tr key={item.id}>
                                                <td className="px-4 py-2.5 text-neutral-200">
                                                    {item.products?.name || "Unknown Item"}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-neutral-400">
                                                    {item.quantity}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-neutral-500">
                                                    {item.unit_price}
                                                </td>
                                                <td className="px-4 py-2.5 text-right font-mono text-neutral-200">
                                                    {item.line_total}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 text-sm">
                                Could not load order details.
                            </div>
                        )}
                    </div>
                )}

            </div>
        </Modal>
    );
}
