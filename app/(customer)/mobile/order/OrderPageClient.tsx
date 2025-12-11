"use client";

import { useState } from "react";
import { ProductList } from "./components/ProductList";
import { CartSheet } from "./components/CartSheet";

// We'll fetch products in the parent server component and pass them down
// But for now, let's make this a client page that accepts products as props
// Actually, let's make the page.tsx a server component and this a client wrapper.

type Product = {
    id: string;
    name: string;
    price: number;
    category: string;
};

import { useSearchParams } from "next/navigation";

export default function OrderPageClient({ products }: { products: Product[] }) {
    const searchParams = useSearchParams();
    const tableIdentifier = searchParams.get("table") || undefined;
    const [cart, setCart] = useState<{ product: Product; quantity: number }[]>([]);

    function addToCart(product: Product) {
        setCart(prev => {
            const existing = prev.find(item => item.product.id === product.id);
            if (existing) {
                return prev.map(item =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { product, quantity: 1 }];
        });
    }

    function removeFromCart(productId: string) {
        setCart(prev => prev.filter(item => item.product.id !== productId));
    }

    function clearCart() {
        setCart([]);
    }

    return (
        <div className="p-6 pb-32 space-y-6 max-w-md mx-auto">
            <header>
                <h1 className="text-2xl font-bold text-neutral-50">Order Food & Drinks</h1>
                <p className="text-neutral-400">Select items to add to your order.</p>
                {tableIdentifier && (
                    <div className="mt-2 inline-block rounded-lg bg-emerald-500/20 px-3 py-1 text-sm font-medium text-emerald-400">
                        Ordering for: {tableIdentifier.startsWith('Table') ? tableIdentifier : `Table ${tableIdentifier}`}
                    </div>
                )}
            </header>

            <ProductList products={products} onAdd={addToCart} />
            <CartSheet items={cart} onRemove={removeFromCart} onClear={clearCart} tableIdentifier={tableIdentifier} />
        </div>
    );
}
