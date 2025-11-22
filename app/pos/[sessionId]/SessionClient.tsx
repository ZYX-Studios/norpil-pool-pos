'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ClientTimer } from "../ClientTimer";
import { PayFormClient } from "./PayFormClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
	getProducts as getOfflineProducts,
	saveProducts as saveOfflineProducts,
	queueOrderItemSetQuantity,
	saveSessionSnapshot,
} from "@/lib/offline/client";

type ItemCategory = "FOOD" | "DRINK" | "OTHER" | "TABLE_TIME";

type SessionItem = {
	id: string;
	productId: string;
	name: string;
	category: ItemCategory;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
	taxRate: number;
};

type SessionProduct = {
	id: string;
	name: string;
	category: ItemCategory;
	price: number;
	taxRate: number;
	stock?: number;
};

type SessionClientProps = {
	sessionId: string;
	tableName: string;
	openedAt: string;
	hourlyRate: number;
	orderId: string;
	initialItems: SessionItem[];
	// Products from the server are used as a starting point and as a seed
	// for the offline cache. The live UI prefers the offline cache once ready.
	products: SessionProduct[];
	errorCode?: string;
};

// Helper to keep money values to 2 decimal places.
function round2(n: number) {
	return Number(n.toFixed(2));
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}

// Compute billed hours for table time using a fixed 5 minute grace window.
// - No charge for the first 5 minutes.
// - After that, hours increase in 60-minute blocks with the same grace per hour.
function computeBilledHours(openedAt: string, nowMs: number, graceMinutes = 5) {
	const openedMs = new Date(openedAt).getTime();
	const elapsedMs = Math.max(0, nowMs - openedMs);
	const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
	if (elapsedMinutes <= graceMinutes) return 0;
	const extra = elapsedMinutes - graceMinutes;
	return Math.ceil(extra / 60);
}

function computeTotals(items: SessionItem[]) {
	let subtotal = 0;
	let taxTotal = 0;

	for (const item of items) {
		// Ignore TABLE_TIME while the session is still open.
		if (item.category === "TABLE_TIME") continue;
		const line = item.lineTotal ?? item.unitPrice * item.quantity;
		subtotal += line;
		taxTotal += round2(line * item.taxRate);
	}

	subtotal = round2(subtotal);
	taxTotal = round2(taxTotal);
	const itemsTotal = round2(subtotal + taxTotal);

	return { subtotal, taxTotal, itemsTotal };
}

export function SessionClient({
	sessionId,
	tableName,
	openedAt,
	hourlyRate,
	orderId,
	initialItems,
	products,
	errorCode,
}: SessionClientProps) {
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);
	const [items, setItems] = useState<SessionItem[]>(initialItems);
	const [productList, setProductList] = useState<SessionProduct[]>(products);
	const [stockWarning, setStockWarning] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [now, setNow] = useState(() => new Date(openedAt).getTime());
	const [isOnline, setIsOnline] = useState(true);
	const [hasQueuedOps, setHasQueuedOps] = useState(false);
	// When an offline payment is queued for this session, we treat the cart as
	// logically closed on this device. This prevents accidental extra edits
	// while we wait for the server to process the queued sale.
	const [isOfflineClosingQueued, setIsOfflineClosingQueued] = useState(false);

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	// Hydrate products from the offline cache when available and keep the
	// cache in sync with the latest products passed from the server.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				// If we already have products cached from a recent sync, prefer those.
				const offline = await getOfflineProducts();
				if (!cancelled && offline.length > 0) {
					setProductList(
						offline.map((p) => ({
							id: p.id,
							name: p.name,
							category: p.category as ItemCategory,
							price: p.price,
							taxRate: p.taxRate,
							stock: typeof p.stock === "number" ? p.stock : undefined,
						})),
					);
				}

				// Always seed the offline cache with the latest server products
				// so that, after a normal online session, this device can still
				// open the POS when offline.
				if (products.length > 0) {
					await saveOfflineProducts(
						products.map((p) => ({
							id: p.id,
							name: p.name,
							category: p.category,
							price: p.price,
							taxRate: p.taxRate,
							stock: typeof p.stock === "number" ? p.stock : null,
						})),
					);
				}
			} catch {
				// If IndexedDB is unavailable (e.g. in private mode) we simply
				// fall back to the in-memory server-provided products.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [products]);

	// Track basic online/offline status for this session so we can explain that
	// cart changes may be queued for later sync.
	useEffect(() => {
		if (typeof window === "undefined") return;

		function handleOnline() {
			setIsOnline(true);
		}

		function handleOffline() {
			setIsOnline(false);
		}

		window.addEventListener("online", handleOnline);
		window.addEventListener("offline", handleOffline);

		return () => {
			window.removeEventListener("online", handleOnline);
			window.removeEventListener("offline", handleOffline);
		};
	}, []);

	// Persist a lightweight session snapshot so that, if the device goes offline,
	// we can still show recent data for this table session.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				await saveSessionSnapshot({
					sessionId,
					tableName,
					openedAt,
					hourlyRate,
					orderId,
					items: items.map((i) => ({
						productId: i.productId,
						name: i.name,
						category: i.category,
						unitPrice: i.unitPrice,
						quantity: i.quantity,
						lineTotal: i.lineTotal,
						taxRate: i.taxRate,
					})),
				});
			} catch {
				// If IndexedDB is not available we silently ignore; the live session
				// view still works as normal.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId, tableName, openedAt, hourlyRate, orderId, items]);

	const { subtotal, taxTotal, itemsTotal } = useMemo(() => computeTotals(items), [items]);
	const billedHours = useMemo(() => computeBilledHours(openedAt, now), [openedAt, now]);
	const tableFee = useMemo(() => round2(billedHours * hourlyRate), [billedHours, hourlyRate]);
	const grandTotal = useMemo(() => round2(itemsTotal + tableFee), [itemsTotal, tableFee]);

	// Optimistically add or increase an item in the cart.
	function handleAddProduct(productId: string) {
		// If a closing payment has already been queued while offline, we freeze
		// further cart edits to avoid double-charging once sync completes.
		if (isOfflineClosingQueued) {
			return;
		}
		const product = productList.find((p) => p.id === productId);
		if (!product) return;

		// Determine the target quantity after this operation so we can use it both
		// for the optimistic UI and any queued offline sync operation.
		const existingLine = items.find((i) => i.productId === productId);
		const targetQty = existingLine ? existingLine.quantity + 1 : 1;

		// Soft stock warning: if this product appears out of stock, we still
		// allow adding it but show a gentle warning to the staff.
		if (typeof product.stock === "number" && product.stock <= 0) {
			setStockWarning(`“${product.name}” is out of stock in inventory. Please confirm before serving.`);
		}

		setItems((prev) => {
			const existing = prev.find((i) => i.productId === productId);
			if (existing) {
				return prev.map((i) =>
					i.productId === productId
						? { ...i, quantity: targetQty, lineTotal: round2(targetQty * i.unitPrice) }
						: i,
				);
			}
			// Use a temporary id for React key; we write using orderId + productId.
			const tempId = `temp-${productId}-${Date.now()}`;
			return [
				...prev,
				{
					id: tempId,
					productId: product.id,
					name: product.name,
					category: product.category,
					unitPrice: product.price,
					quantity: targetQty,
					lineTotal: round2(product.price * targetQty),
					taxRate: product.taxRate,
				},
			];
		});

		// Persist in the background. UI stays snappy even if the network is slow.
		startTransition(() => {
			void syncAddItem(orderId, productId, targetQty, supabase, () => setHasQueuedOps(true));
		});
	}

	// Optimistically update quantity (or remove) for an item.
	function handleChangeQuantity(productId: string, nextQty: number) {
		if (isOfflineClosingQueued) {
			return;
		}
		setItems((prev) => {
			const existing = prev.find((i) => i.productId === productId);
			if (!existing) return prev;
			if (nextQty <= 0) {
				return prev.filter((i) => i.productId !== productId);
			}
			return prev.map((i) =>
				i.productId === productId
					? { ...i, quantity: nextQty, lineTotal: round2(nextQty * i.unitPrice) }
					: i,
			);
		});

		startTransition(() => {
			void syncUpdateQuantity(orderId, productId, nextQty, supabase, () => setHasQueuedOps(true));
		});
	}

	return (
		<div className="mx-auto grid max-w-7xl grid-cols-1 gap-4 p-4 sm:p-6 lg:grid-cols-12">
			<section className="space-y-4 lg:col-span-4">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-3 flex items-center justify-between gap-2">
						<div className="flex items-center gap-3">
							<Link
								href="/pos"
								className="rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[11px] font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
							>
								← Back to tables
							</Link>
							<div>
								<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
									Table
								</div>
								<div className="text-lg font-semibold text-neutral-50">{tableName}</div>
							</div>
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
					<div className="mb-2 flex items-center justify-between">
						<h2 className="text-sm font-semibold text-neutral-50">Cart</h2>
						<div className="flex items-center gap-2">
							{isPending && (
								<span className="text-[10px] text-neutral-400">Syncing…</span>
							)}
							{(!isOnline || hasQueuedOps) && (
								<span className="text-[10px] text-amber-300">
									{isOnline
										? "Offline changes will sync automatically."
										: "Offline – cart changes are queued and will sync when back online."}
								</span>
							)}
							{isOfflineClosingQueued && (
								<span className="text-[10px] text-emerald-300">
									Offline payment queued – cart edits are paused until the server confirms closure.
								</span>
							)}
						</div>
					</div>
					{stockWarning && (
						<div className="mb-2 rounded border border-amber-400/50 bg-amber-500/10 px-2 py-1 text-[11px] text-amber-100">
							{stockWarning}
						</div>
					)}
					<div className="space-y-3">
						{items.filter((i) => i.category !== "TABLE_TIME").map((i) => (
							<div key={i.id} className="flex items-center justify-between">
								<div>
									<div className="font-medium">{i.name}</div>
									<div className="text-xs text-neutral-500">
										{formatCurrency(i.unitPrice)} × {i.quantity}
									</div>
								</div>
								<div className="flex items-center gap-2">
									<button
										type="button"
										onClick={() => handleChangeQuantity(i.productId, i.quantity - 1)}
										className="rounded border px-2 py-1 text-sm hover:bg-neutral-50"
									>
										-
									</button>
									<div className="w-10 text-center text-sm">{i.quantity}</div>
									<button
										type="button"
										onClick={() => handleChangeQuantity(i.productId, i.quantity + 1)}
										className="rounded border px-2 py-1 text-sm hover:bg-neutral-50"
									>
										+
									</button>
								</div>
								<div className="w-20 text-right font-medium">
									{formatCurrency(i.lineTotal)}
								</div>
							</div>
						))}
						{items.filter((i) => i.category !== "TABLE_TIME").length === 0 && (
							<div className="text-sm text-neutral-400">No items yet.</div>
						)}
					</div>
					{billedHours > 0 && (
						<div className="mt-3 border-t border-dashed border-white/15 pt-2 text-sm">
							<div className="flex items-center justify-between">
								<div>
									<div className="font-medium text-neutral-50">Table time</div>
									<div className="text-xs text-neutral-400">
										{billedHours} hour{billedHours > 1 ? "s" : ""} × {formatCurrency(hourlyRate)}
									</div>
								</div>
								<div className="w-24 text-right font-medium">
									{formatCurrency(tableFee)}
								</div>
							</div>
						</div>
					)}

					<div className="mt-4 border-t border-white/10 pt-3 text-sm">
						<div className="flex justify-between text-neutral-300">
							<span>Subtotal</span>
							<span>{formatCurrency(subtotal)}</span>
						</div>
						<div className="flex justify-between text-neutral-300">
							<span>Tax</span>
							<span>{formatCurrency(taxTotal)}</span>
						</div>
						<div className="mt-2 flex justify-between text-base font-semibold text-neutral-50">
							<span>Items total</span>
							<span>{formatCurrency(itemsTotal)}</span>
						</div>
						<div className="mt-1 flex justify-between text-sm text-neutral-200">
							<span>Table time</span>
							<span>{formatCurrency(tableFee)}</span>
						</div>
						<div className="mt-1 flex justify-between text-base font-semibold text-emerald-300">
							<span>Grand total</span>
							<span>{formatCurrency(grandTotal)}</span>
						</div>
					</div>
				</div>

				<PayFormClient
					sessionId={sessionId}
					suggestedAmount={grandTotal}
					errorCode={errorCode}
					onOfflineQueued={() => setIsOfflineClosingQueued(true)}
				/>
			</section>

			<section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur lg:col-span-8">
				<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-sm font-semibold text-neutral-50">Products</h2>
						<p className="text-xs text-neutral-400">Tap to add to this table’s order.</p>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
					{productList
						.filter((p) => p.category !== "TABLE_TIME")
						.map((p) => (
							<button
								key={p.id}
								type="button"
								onClick={() => handleAddProduct(p.id)}
								className="flex w-full flex-col items-start rounded-2xl border border-white/10 bg-black/30 p-3 text-left shadow-sm shadow-black/40 transition hover:border-emerald-400/60 hover:bg-black/60"
							>
								<div className="text-sm font-medium text-neutral-50">{p.name}</div>
								<div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
									{p.category}
								</div>
								<div className="mt-2 flex w-full items-baseline justify-between gap-2 text-sm text-neutral-100">
									<span>{formatCurrency(p.price)}</span>
									{typeof p.stock === "number" && (
										<span
											className={`text-[10px] font-medium ${p.stock <= 0
												? "text-red-300"
												: p.stock <= 5
													? "text-amber-300"
													: "text-neutral-400"
												}`}
										>
											{p.stock <= 0 ? "OUT" : p.stock <= 5 ? `Low · ${p.stock}` : `${p.stock}`}
										</span>
									)}
								</div>
							</button>
						))}
				</div>
			</section>
		</div>
	);
}

// Persist add-item change using Supabase from the browser.
// On failure (e.g. offline), we enqueue an offline operation so the change
// can be replayed when the device reconnects.
async function syncAddItem(
	orderId: string,
	productId: string,
	targetQty: number,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
	onQueued?: () => void,
) {
	try {
		// Find existing line for this order + product.
		const { data: existing } = await supabase
			.from("order_items")
			.select("id, quantity, unit_price")
			.eq("order_id", orderId)
			.eq("product_id", productId)
			.maybeSingle();

		if (existing?.id) {
			const nextQty = (existing.quantity as number) + 1;
			const lineTotal = round2(nextQty * Number(existing.unit_price));
			await supabase
				.from("order_items")
				.update({ quantity: nextQty, line_total: lineTotal })
				.eq("id", existing.id);
		} else {
			// Load product price for a safe server-side write.
			const { data: product } = await supabase
				.from("products")
				.select("price")
				.eq("id", productId)
				.maybeSingle();
			const unitPrice = Number(product?.price ?? 0);
			const lineTotal = round2(unitPrice * 1);
			await supabase.from("order_items").insert({
				order_id: orderId,
				product_id: productId,
				quantity: 1,
				unit_price: unitPrice,
				line_total: lineTotal,
			});
		}
	} catch (error) {
		console.error("Failed to sync add item, queueing offline op", error);
		await queueOrderItemSetQuantity({
			orderId,
			productId,
			nextQty: targetQty,
		});
		if (onQueued) onQueued();
	}
}

// Persist quantity change (or delete) using Supabase from the browser.
// On failure (e.g. offline), we enqueue an offline operation so the change
// can be replayed later.
async function syncUpdateQuantity(
	orderId: string,
	productId: string,
	nextQty: number,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
	onQueued?: () => void,
) {
	try {
		const { data: line } = await supabase
			.from("order_items")
			.select("id, unit_price")
			.eq("order_id", orderId)
			.eq("product_id", productId)
			.maybeSingle();

		if (!line?.id) {
			return;
		}

		if (nextQty <= 0) {
			await supabase.from("order_items").delete().eq("id", line.id);
			return;
		}

		const lineTotal = round2(nextQty * Number(line.unit_price));
		await supabase
			.from("order_items")
			.update({ quantity: nextQty, line_total: lineTotal })
			.eq("id", line.id);
	} catch (error) {
		console.error("Failed to sync quantity change, queueing offline op", error);
		await queueOrderItemSetQuantity({
			orderId,
			productId,
			nextQty,
		});
		if (onQueued) onQueued();
	}
}


