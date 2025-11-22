'use client';

import { useEffect, useState } from "react";
import { ClientTimer } from "../ClientTimer";
import {
	getSessionSnapshot,
	getProducts as getOfflineProducts,
	type OfflineSessionSnapshot,
	type OfflineProduct,
} from "@/lib/offline/client";
import { SessionClient } from "./SessionClient";

type SessionOfflineFallbackProps = {
	sessionId: string;
};

/**
 * Offline-friendly fallback for the session page.
 * - When the server cannot load the session (e.g. offline), the server page
 *   renders this component instead of a hard 404.
 * - We try to load a cached snapshot from IndexedDB. If it exists, we show a
 *   read-only view of the table and its last known cart.
 */
export function SessionOfflineFallback({ sessionId }: SessionOfflineFallbackProps) {
	const [snapshot, setSnapshot] = useState<OfflineSessionSnapshot | null>(null);
	const [offlineProducts, setOfflineProducts] = useState<OfflineProduct[] | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				// Load the last known session snapshot from IndexedDB.
				const snap = await getSessionSnapshot(sessionId);
				// In parallel, try to hydrate cached products so we can offer a
				// fully interactive offline experience (add items, queue ops).
				let products: OfflineProduct[] | null = null;
				try {
					products = await getOfflineProducts();
				} catch {
					// If we cannot read the products cache (e.g. private mode)
					// we will still show a read-only snapshot below.
					products = null;
				}
				if (!cancelled) {
					setSnapshot(snap);
					setOfflineProducts(products);
				}
			} catch {
				if (!cancelled) {
					setSnapshot(null);
					setOfflineProducts(null);
				}
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId]);

	if (loading) {
		return (
			<div className="mx-auto max-w-3xl space-y-3 p-4 text-sm text-neutral-100">
				<h1 className="text-lg font-semibold text-neutral-50">Loading session…</h1>
				<p className="text-xs text-neutral-300">Trying to load cached data for this table session.</p>
			</div>
		);
	}

	// If we have no cached session at all, we fall back to a simple read-only
	// explanation. This usually means the table was never opened on this device.
	if (!snapshot) {
		return (
			<div className="mx-auto max-w-3xl space-y-3 p-4 text-sm text-neutral-100">
				<h1 className="text-lg font-semibold text-neutral-50">Session unavailable</h1>
				<p className="text-xs text-neutral-300">
					This table session could not be loaded from the server, and there is no cached copy on this device.
					You might be offline or the session was never opened on this POS terminal.
				</p>
			</div>
		);
	}

	const { tableName, openedAt, hourlyRate, items, orderId } = snapshot;
	const subtotal = items.reduce((sum, i) => sum + i.lineTotal, 0);
	const taxTotal = items.reduce((sum, i) => sum + i.lineTotal * i.taxRate, 0);
	const itemsTotal = subtotal + taxTotal;

	// If we have both a session snapshot and cached products, we can bootstrap
	// the full interactive SessionClient purely from offline data. This lets
	// staff continue adding items and even queueing payments during a cold
	// offline start, which is standard POS behaviour.
	if (offlineProducts && offlineProducts.length > 0) {
		const sessionProducts = offlineProducts.map((p) => ({
			id: p.id,
			name: p.name,
			// Offline cache stores category as a string; we pass it through to
			// the SessionClient which already understands the allowed values.
			category: p.category as any,
			price: p.price,
			taxRate: p.taxRate,
			stock: typeof p.stock === "number" ? p.stock : undefined,
		}));

		const initialItems = items.map((i, index) => ({
			// We only need a stable React key here; the server-side id is not
			// required for queued offline operations which use orderId+productId.
			id: `${i.productId}-${index}`,
			productId: i.productId,
			name: i.name,
			category: i.category as any,
			unitPrice: i.unitPrice,
			quantity: i.quantity,
			lineTotal: i.lineTotal,
			taxRate: i.taxRate,
		}));

		return (
			<SessionClient
				sessionId={snapshot.sessionId}
				tableName={tableName}
				openedAt={openedAt}
				hourlyRate={hourlyRate}
				orderId={orderId}
				initialItems={initialItems}
				products={sessionProducts}
				// We pass a friendly error code so the payment form and cart
				// can still surface that we are running from an offline seed.
				errorCode="offline_snapshot"
			/>
		);
	}

	return (
		<div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-12">
			<section className="space-y-4 lg:col-span-4">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-3 flex items-center justify-between">
						<div>
							<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
								Table
							</div>
							<div className="text-lg font-semibold text-neutral-50">{tableName}</div>
						</div>
						<div className="text-right text-xs text-neutral-400">
							<div>Rate</div>
							<div className="font-mono text-sm text-neutral-100">
								₱{hourlyRate.toFixed(2)}/hr
							</div>
						</div>
					</div>
					<ClientTimer openedAt={openedAt} hourlyRate={hourlyRate} itemTotal={itemsTotal} />
				</div>

				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur">
					<h2 className="mb-2 text-sm font-semibold text-neutral-50">Cart (read-only)</h2>
					<p className="mb-3 text-xs text-neutral-300">
						Showing the last known state of this table from this device. Changes made while offline
						will sync automatically when the connection is restored.
					</p>
					<div className="space-y-3">
						{items.length > 0 ? (
							items.map((i) => (
								<div key={`${i.productId}-${i.name}`} className="flex items-center justify-between">
									<div>
										<div className="font-medium">{i.name}</div>
										<div className="text-xs text-neutral-500">
											{formatCurrency(i.unitPrice)} × {i.quantity}
										</div>
									</div>
									<div className="w-20 text-right font-medium">
										{formatCurrency(i.lineTotal)}
									</div>
								</div>
							))
						) : (
							<div className="text-sm text-neutral-400">No items in the last saved snapshot.</div>
						)}
					</div>
					<div className="mt-4 border-t border-white/10 pt-3 text-sm">
						<div className="flex justify-between text-neutral-300">
							<span>Subtotal</span>
							<span>{formatCurrency(subtotal)}</span>
						</div>
						<div className="flex justify-between text-neutral-300">
							<span>Tax</span>
							<span>{formatCurrency(taxTotal)}</span>
						</div>
						<div className="mt-2 flex justify-between text-base font-semibold text-emerald-300">
							<span>Items total</span>
							<span>{formatCurrency(itemsTotal)}</span>
						</div>
					</div>
				</div>
			</section>

			<section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur lg:col-span-8">
				<h2 className="mb-2 text-sm font-semibold text-neutral-50">Offline view</h2>
				<p className="text-xs text-neutral-300">
					Server data is currently unavailable. This snapshot was saved the last time this session was
					open on this device. You can continue serving the guest; once the connection returns, the POS
					will sync any queued changes to the server.
				</p>
			</section>
		</div>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}



