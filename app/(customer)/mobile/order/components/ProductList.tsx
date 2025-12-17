"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

type Product = {
    id: string;
    name: string;
    price: number;
    category: string;
    stock: number;
};

type ProductListProps = {
    products: Product[];
    onAdd: (product: Product) => void;
};

export function ProductList({ products, onAdd }: ProductListProps) {
    // Derive unique categories from products, sorted alphabetically
    const categories = Array.from(new Set(products.map(p => p.category))).sort();

    // Default to first category if available
    const [activeCategory, setActiveCategory] = useState(categories[0] || "FOOD");

    const filteredProducts = products.filter(p => p.category === activeCategory);

    return (
        <div className="space-y-4">
            <div className="flex space-x-2 overflow-x-auto pb-2 no-scrollbar">
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap",
                            activeCategory === cat
                                ? "bg-emerald-500 text-white"
                                : "bg-white/5 text-neutral-400 hover:bg-white/10"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
                {filteredProducts.map(product => (
                    <button
                        key={product.id}
                        onClick={() => onAdd(product)}
                        disabled={product.stock <= 0}
                        className={cn(
                            "flex flex-col items-start justify-between rounded-2xl border border-white/10 p-4 text-left shadow-sm backdrop-blur transition-all",
                            product.stock <= 0
                                ? "bg-white/5 opacity-50 cursor-not-allowed"
                                : "bg-white/5 hover:bg-white/10 active:scale-95"
                        )}
                    >
                        <div className="w-full">
                            <div className="font-semibold text-neutral-50 truncate">{product.name}</div>
                            <div className="flex items-center justify-between mt-1">
                                <div className="text-sm text-emerald-400 font-medium">
                                    ₱{product.price.toLocaleString()}
                                </div>
                                {product.stock <= 0 && (
                                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-wider">
                                        Sold Out
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className={cn(
                            "mt-3 self-end rounded-full p-1.5",
                            product.stock <= 0 ? "bg-white/5 text-neutral-500" : "bg-white/10 text-neutral-300"
                        )}>
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                            </svg>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
