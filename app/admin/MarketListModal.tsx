'use client';

import { useState } from "react";
import { createPortal } from "react-dom";

type MarketItem = {
    id: string;
    name: string;
    unit: string;
    min_stock: number;
    max_stock: number;
    currentStock: number;
    amountNeeded: number;
};

type MarketListModalProps = {
    lowStockItems: MarketItem[];
    restockItems: MarketItem[];
    trackedItemCount: number;
};

export function MarketListModal({ lowStockItems, restockItems, trackedItemCount }: MarketListModalProps) {
    const [isOpen, setIsOpen] = useState(false);

    const lowStockCount = lowStockItems.length;
    const restockCount = restockItems.length;
    const totalNeeded = lowStockCount + restockCount;

    // Determine the status color and message for the trigger card
    let triggerColor = "border-white/10 bg-white/5 hover:bg-white/10";
    let iconColor = "text-neutral-400";
    let titleColor = "text-neutral-50";
    let statusMessage = "All tracked items are fully stocked.";

    if (lowStockCount > 0) {
        triggerColor = "border-red-500/20 bg-red-500/10 hover:bg-red-500/20";
        iconColor = "text-red-400";
        titleColor = "text-red-100";
        statusMessage = `${lowStockCount} item${lowStockCount === 1 ? "" : "s"} low on stock.`;
    } else if (restockCount > 0) {
        triggerColor = "border-emerald-500/20 bg-emerald-500/10 hover:bg-emerald-500/20";
        iconColor = "text-emerald-400";
        titleColor = "text-emerald-100";
        statusMessage = `${restockCount} item${restockCount === 1 ? "" : "s"} can be restocked.`;
    } else if (trackedItemCount === 0) {
        statusMessage = "Set Max Stock levels to enable.";
    }

    return (
        <>
            {/* Trigger Card */}
            <button
                onClick={() => setIsOpen(true)}
                className={`group flex w-full items-center justify-between rounded-2xl border p-6 shadow-sm shadow-black/40 backdrop-blur transition-all ${triggerColor}`}
            >
                <div className="flex items-center gap-4">
                    <div className={`rounded-full p-3 ${lowStockCount > 0 ? "bg-red-500/20" : restockCount > 0 ? "bg-emerald-500/20" : "bg-white/10"}`}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className={`h-6 w-6 ${iconColor}`}>
                            <path fillRule="evenodd" d="M7.5 6v.75H5.513c-.96 0-1.764.724-1.865 1.679l-1.263 12A1.875 1.875 0 004.25 22.5h15.5a1.875 1.875 0 001.865-2.071l-1.263-12a1.875 1.875 0 00-1.865-1.679H16.5V6a4.5 4.5 0 10-9 0zM12 3a3 3 0 00-3 3v.75h6V6a3 3 0 00-3-3zm-3 8.25a3 3 0 106 0v-.75a.75.75 0 011.5 0v.75a4.5 4.5 0 11-9 0v-.75a.75.75 0 011.5 0v.75z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <div className="text-left">
                        <div className={`text-lg font-semibold ${titleColor}`}>Market List</div>
                        <div className="text-sm text-neutral-400">{statusMessage}</div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm font-medium text-neutral-500 group-hover:text-neutral-300">
                    View List
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                </div>
            </button>

            {/* Modal */}
            {isOpen &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 backdrop-blur-sm">
                        <div className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl shadow-black">
                            {/* Header */}
                            <div className="flex items-center justify-between border-b border-white/10 p-6">
                                <div>
                                    <h2 className="text-xl font-semibold text-neutral-50">Market List</h2>
                                    <p className="text-sm text-neutral-400">
                                        Items to purchase based on current stock vs max capacity.
                                    </p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-full border border-white/10 p-2 text-neutral-400 hover:bg-white/10 hover:text-neutral-50"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                                    </svg>
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                {trackedItemCount === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="rounded-full bg-neutral-900 p-4 text-neutral-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
                                            </svg>
                                        </div>
                                        <h3 className="mt-4 text-lg font-medium text-neutral-50">No tracked items</h3>
                                        <p className="mt-2 text-sm text-neutral-400">
                                            Set a <strong>Max Stock</strong> level for your inventory items to see them here.
                                        </p>
                                    </div>
                                ) : totalNeeded === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <div className="rounded-full bg-emerald-500/10 p-4 text-emerald-500">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="h-8 w-8">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </div>
                                        <h3 className="mt-4 text-lg font-medium text-neutral-50">All stocked up!</h3>
                                        <p className="mt-2 text-sm text-neutral-400">
                                            Everything is at or above its minimum stock level.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="space-y-8">
                                        {/* Low Stock Section */}
                                        {lowStockItems.length > 0 && (
                                            <div>
                                                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-red-400">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                    Low Stock Alert
                                                </h3>
                                                <div className="overflow-hidden rounded-xl border border-red-500/20 bg-red-500/5">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-red-500/10 text-red-200 uppercase tracking-wider text-xs">
                                                            <tr>
                                                                <th className="px-4 py-3 font-medium">Item</th>
                                                                <th className="px-4 py-3 font-medium text-right">Current</th>
                                                                <th className="px-4 py-3 font-medium text-right">Target</th>
                                                                <th className="px-4 py-3 font-medium text-right">Order</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-red-500/10">
                                                            {lowStockItems.map((item) => (
                                                                <tr key={item.id} className="hover:bg-red-500/5">
                                                                    <td className="px-4 py-3 font-medium text-red-100">{item.name}</td>
                                                                    <td className="px-4 py-3 text-right text-red-200/70">
                                                                        {item.currentStock} <span className="text-xs">{item.unit}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-red-200/70">
                                                                        {item.max_stock} <span className="text-xs">{item.unit}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-bold text-red-400">
                                                                        {item.amountNeeded} <span className="text-xs font-normal text-red-400/70">{item.unit}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Restock Section */}
                                        {restockItems.length > 0 && (
                                            <div>
                                                <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-emerald-400">
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                                                        <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                                    </svg>
                                                    Stock to Full
                                                </h3>
                                                <div className="overflow-hidden rounded-xl border border-white/10 bg-white/5">
                                                    <table className="w-full text-left text-sm">
                                                        <thead className="bg-white/5 text-neutral-400 uppercase tracking-wider text-xs">
                                                            <tr>
                                                                <th className="px-4 py-3 font-medium">Item</th>
                                                                <th className="px-4 py-3 font-medium text-right">Current</th>
                                                                <th className="px-4 py-3 font-medium text-right">Target</th>
                                                                <th className="px-4 py-3 font-medium text-right">Order</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-white/5">
                                                            {restockItems.map((item) => (
                                                                <tr key={item.id} className="hover:bg-white/5">
                                                                    <td className="px-4 py-3 font-medium text-neutral-200">{item.name}</td>
                                                                    <td className="px-4 py-3 text-right text-neutral-400">
                                                                        {item.currentStock} <span className="text-xs">{item.unit}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right text-neutral-400">
                                                                        {item.max_stock} <span className="text-xs">{item.unit}</span>
                                                                    </td>
                                                                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                                                                        {item.amountNeeded} <span className="text-xs font-normal text-emerald-400/70">{item.unit}</span>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="border-t border-white/10 p-4 flex justify-end">
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-neutral-200 hover:bg-white/20"
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
