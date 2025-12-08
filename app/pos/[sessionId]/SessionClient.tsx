'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { updateSessionCustomerName, pauseSession, resumeSession, releaseTable } from "../actions";

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
	customerName?: string;
	errorCode?: string;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
	isTableSession?: boolean;
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

// Compute table fee based on session configuration
function computeTableFee(
	openedAt: string,
	nowMs: number,
	hourlyRate: number,
	pausedAt?: string | null,
	accumulatedPausedTime = 0,
	sessionType: "OPEN" | "FIXED" = "OPEN",
	targetDurationMinutes?: number,
	isMoneyGame?: boolean,
	betAmount?: number
) {
	const openedMs = new Date(openedAt).getTime();
	const accumulated = accumulatedPausedTime * 1000;
	let elapsedMs = 0;
	if (pausedAt) {
		const pauseStart = new Date(pausedAt).getTime();
		elapsedMs = Math.max(0, pauseStart - openedMs - accumulated);
	} else {
		elapsedMs = Math.max(0, nowMs - openedMs - accumulated);
	}

	const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
	let tableFee = 0;

	if (sessionType === "FIXED" && targetDurationMinutes) {
		const baseFee = (targetDurationMinutes / 60) * hourlyRate;
		const excessMinutes = Math.max(0, elapsedMinutes - targetDurationMinutes);
		const excessFee = excessMinutes * (hourlyRate / 60);
		// Return gross fee; prepaid logic is handled in the component
		tableFee = baseFee + excessFee;
	} else {
		// Open Time default
		if (elapsedMinutes > 5) {
			const blocks = Math.ceil(elapsedMinutes / 30);
			tableFee = blocks * 0.5 * hourlyRate;
		}
	}

	if (isMoneyGame && betAmount) {
		tableFee = Math.max(tableFee, betAmount * 0.10);
	}

	return round2(tableFee);
}

function computeTotals(items: SessionItem[]) {
	// ... existing computeTotals ...
	let subtotal = 0;
	let taxTotal = 0;

	for (const item of items) {
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
	customerName,
	errorCode,
	pausedAt,
	accumulatedPausedTime = 0,
	isTableSession = true,
	sessionType = "OPEN",
	targetDurationMinutes,
	isMoneyGame,
	betAmount,
	isPrepaid,
}: SessionClientProps & {
	sessionType?: "OPEN" | "FIXED";
	targetDurationMinutes?: number;
	isMoneyGame?: boolean;
	betAmount?: number;
	isPrepaid?: boolean;
}) {
	// ... component state ...
	const router = useRouter();
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);
	const [items, setItems] = useState<SessionItem[]>(initialItems);
	const [productList, setProductList] = useState<SessionProduct[]>(products);
	const [activeCategory, setActiveCategory] = useState<ItemCategory | "ALL">("ALL");
	const [stockWarning, setStockWarning] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [now, setNow] = useState(() => Date.now());
	const [isOnline, setIsOnline] = useState(true);
	const [hasQueuedOps, setHasQueuedOps] = useState(false);
	const [isOfflineClosingQueued, setIsOfflineClosingQueued] = useState(false);
	const [showReleaseModal, setShowReleaseModal] = useState(false);
	const [releaseName, setReleaseName] = useState("");
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (pausedAt) return;
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [pausedAt]);

	// ... offline sync effects ...
	// Hydrate products from the offline cache when available and keep the
	// cache in sync with the latest products passed from the server.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
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

	// Persist a lightweight session snapshot
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
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [sessionId, tableName, openedAt, hourlyRate, orderId, items]);

	const { subtotal, taxTotal, itemsTotal } = useMemo(() => computeTotals(items), [items]);

	// We only compute time-based fees on the client after mount to avoid hydration mismatch.
	const tableFee = useMemo(() => {
		if (!isMounted || !isTableSession) return 0;
		return computeTableFee(
			openedAt,
			now,
			hourlyRate,
			pausedAt,
			accumulatedPausedTime,
			sessionType,
			targetDurationMinutes,
			isMoneyGame,
			betAmount
		);
	}, [openedAt, now, hourlyRate, pausedAt, accumulatedPausedTime, isMounted, isTableSession, sessionType, targetDurationMinutes, isMoneyGame, betAmount]);

	const prepaidCredit = useMemo(() => {
		if (isPrepaid && sessionType === 'FIXED' && targetDurationMinutes) {
			return (targetDurationMinutes / 60) * hourlyRate;
		}
		return 0;
	}, [isPrepaid, sessionType, targetDurationMinutes, hourlyRate]);

	const netTableFee = Math.max(0, tableFee - prepaidCredit);

	const grandTotal = useMemo(() => round2(itemsTotal + netTableFee), [itemsTotal, netTableFee]);

	// ... rest of component until return ...
	const visibleProducts = useMemo(
		() =>
			productList.filter((p) => {
				if (p.category === "TABLE_TIME") return false;
				if (activeCategory === "ALL") return true;
				return p.category === activeCategory;
			}),
		[productList, activeCategory],
	);

	function handleAddProduct(productId: string) {
		// ... existing handleAddProduct ...
		if (isOfflineClosingQueued) {
			return;
		}
		const product = productList.find((p) => p.id === productId);
		if (!product) return;

		const existingLine = items.find((i) => i.productId === productId);
		const targetQty = existingLine ? existingLine.quantity + 1 : 1;

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

		startTransition(() => {
			void syncAddItem(orderId, productId, targetQty, supabase, () => setHasQueuedOps(true));
		});
	}

	function handleChangeQuantity(productId: string, nextQty: number) {
		// ... existing handleChangeQuantity ...
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
			{/* Release Table Modal */}
			{showReleaseModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
					<div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
						<h3 className="mb-2 text-lg font-semibold text-white">Release Table</h3>
						<p className="mb-4 text-sm text-neutral-400">
							This will free up the table for new customers. The current session will continue as a "Walk-in".
						</p>

						<div className="mb-6">
							<label className="mb-2 block text-xs font-medium uppercase tracking-wider text-neutral-500">
								Customer Name (Optional)
							</label>
							<input
								type="text"
								value={releaseName}
								onChange={(e) => setReleaseName(e.target.value)}
								placeholder="e.g. John Doe"
								className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-neutral-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
								autoFocus
							/>
						</div>

						<div className="flex gap-3">
							<button
								onClick={() => setShowReleaseModal(false)}
								className="flex-1 rounded-xl border border-white/10 bg-white/5 py-3 text-sm font-medium text-neutral-300 hover:bg-white/10"
							>
								Cancel
							</button>
							<button
								onClick={() => {
									startTransition(async () => {
										await releaseTable(sessionId, releaseName || undefined);
										setShowReleaseModal(false);
									});
								}}
								className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-medium text-white hover:bg-emerald-400"
							>
								Confirm Release
							</button>
						</div>
					</div>
				</div>
			)}

			<section className="space-y-4 lg:col-span-4">
				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-3 flex items-center justify-between gap-2">
						{/* ... existing header ... */}
						<div className="flex items-center gap-3">
							<button
								onClick={() => {
									window.location.href = "/pos";
								}}
								className="rounded-full border border-white/15 bg-black/40 px-3 py-2 text-xs font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
							>
								← Back
							</button>
							<div>
								<div className="text-xs font-medium uppercase tracking-[0.18em] text-neutral-400">
									{customerName ? "Customer" : "Table"}
								</div>
								<div className="flex items-center gap-2">
									<div className="text-lg sm:text-xl font-semibold text-neutral-50">
										{customerName ?? tableName}
									</div>
									{customerName && (
										<button
											onClick={() => {
												const newName = window.prompt("Update customer name:", customerName);
												if (newName && newName !== customerName) {
													startTransition(async () => {
														await updateSessionCustomerName(sessionId, newName);
													});
												}
											}}
											className="rounded-full p-1 text-neutral-400 hover:bg-white/10 hover:text-white"
										>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
												<path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
												<path d="M3.5 5.75c0-.69.56-1.25 1.25-1.25H10A.75.75 0 0010 3H4.75A2.75 2.75 0 002 5.75v9.5A2.75 2.75 0 004.75 18h9.5A2.75 2.75 0 0017 15.25V10a.75.75 0 00-1.5 0v5.25c0 .69-.56 1.25-1.25 1.25h-9.5c-.69 0-1.25-.56-1.25-1.25v-9.5z" />
											</svg>
										</button>
									)}
								</div>
							</div>
						</div>
						{!customerName && (
							<div className="text-right text-xs sm:text-sm text-neutral-400">
								<div>Rate</div>
								<div className="font-mono text-sm sm:text-base text-neutral-100">
									₱{hourlyRate.toFixed(2)}/hr
								</div>
							</div>
						)}
					</div>
					{isTableSession && (
						<div className="space-y-3">
							<ClientTimer
								openedAt={openedAt}
								hourlyRate={hourlyRate}
								itemTotal={itemsTotal}
								pausedAt={pausedAt}
								accumulatedPausedTime={accumulatedPausedTime}
								isPrepaid={isPrepaid}
							/>
							<div className="flex gap-2">
								{pausedAt ? (
									<button
										onClick={() => startTransition(async () => await resumeSession(sessionId))}
										className="flex-1 rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-2 text-sm font-medium text-emerald-400 hover:bg-emerald-500/20 active:scale-[0.98]"
									>
										Resume Timer
									</button>
								) : (
									<button
										onClick={() => startTransition(async () => await pauseSession(sessionId))}
										className="flex-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-sm font-medium text-amber-400 hover:bg-amber-500/20 active:scale-[0.98]"
									>
										Pause Timer
									</button>
								)}
								<button
									onClick={() => {
										setReleaseName("");
										setShowReleaseModal(true);
									}}
									className="flex-1 rounded-xl border border-white/10 bg-white/5 py-2 text-sm font-medium text-neutral-300 hover:bg-white/10 active:scale-[0.98]"
								>
									Release Table
								</button>
							</div>
						</div>
					)}
				</div>

				<div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur">
					<div className="mb-2 flex items-center justify-between">
						<h2 className="text-sm font-semibold text-neutral-50">Cart</h2>
						<div className="flex items-center gap-2">
							{isPending && (
								<span className="text-[11px] text-neutral-400">Syncing…</span>
							)}
							{(!isOnline || hasQueuedOps) && (
								<span className="text-[11px] text-amber-300">
									{isOnline
										? "Offline changes will sync automatically."
										: "Offline – cart changes are queued and will sync when back online."}
								</span>
							)}
							{isOfflineClosingQueued && (
								<span className="text-[11px] text-emerald-300">
									Offline payment queued – cart edits are paused until the server confirms closure.
								</span>
							)}
						</div>
					</div>
					{stockWarning && (
						<div className="mb-2 rounded border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
							{stockWarning}
						</div>
					)}
					<div className="space-y-3 sm:space-y-4">
						{/* ... items map ... */}
						{items.map((i) => (
							<div
								key={i.id}
								className="flex items-center justify-between gap-3 rounded-xl px-1 py-2 sm:px-2 sm:py-3"
							>
								<div>
									<div className="text-sm sm:text-base font-medium">{i.name}</div>
									<div className="text-xs sm:text-sm text-neutral-500">
										{formatCurrency(i.unitPrice)} × {i.quantity}
									</div>
								</div>
								<div className="flex items-center gap-3">
									<button
										type="button"
										onClick={() => handleChangeQuantity(i.productId, i.quantity - 1)}
										className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-neutral-900 text-base font-semibold text-neutral-50 shadow-sm shadow-black/40 transition hover:bg-neutral-50 hover:text-neutral-900 active:scale-95"
									>
										-
									</button>
									<div className="w-8 text-center text-sm sm:text-base font-medium">
										{i.quantity}
									</div>
									<button
										type="button"
										onClick={() => handleChangeQuantity(i.productId, i.quantity + 1)}
										className="flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-neutral-900 text-base font-semibold text-neutral-50 shadow-sm shadow-black/40 transition hover:bg-neutral-50 hover:text-neutral-900 active:scale-95"
									>
										+
									</button>
								</div>
								<div className="w-20 text-right text-sm sm:text-base font-semibold">
									{formatCurrency(i.lineTotal)}
								</div>
							</div>
						))}
						{items.length === 0 && (
							<div className="text-sm sm:text-base text-neutral-400">
								No items yet. Tap a product on the right to add it.
							</div>
						)}
					</div>
					{tableFee > 0 && (
						<div className="mt-3 border-t border-dashed border-white/15 pt-2 text-sm">
							<div className="flex items-center justify-between">
								<div>
									<div className="font-medium text-neutral-50">Table time</div>
									<div className="text-xs text-neutral-400">
										{sessionType === 'FIXED' && targetDurationMinutes
											? `Fixed ${targetDurationMinutes / 60}h + Excess`
											: isMoneyGame
												? "Money Game (Min 10%)"
												: `${formatCurrency(hourlyRate)}/hr`
										}
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
							<div className="flex items-center gap-2">
								<span>Table time</span>
							</div>
							<span>{formatCurrency(tableFee)}</span>
						</div>
						{prepaidCredit > 0 && (
							<div className="mt-1 flex justify-between text-sm text-emerald-400">
								<span>Less: Prepaid</span>
								<span>-{formatCurrency(prepaidCredit)}</span>
							</div>
						)}
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

			<section className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur lg:col-span-8">
				<div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-sm sm:text-base font-semibold text-neutral-50">Products</h2>
						<p className="text-xs sm:text-sm text-neutral-400">
							Tap any item to add it to this table’s order.
						</p>
					</div>
					{/* 
						Simple category filter:
						- Large pill buttons that are easy to tap on tablets.
						- Lets staff quickly switch between Food / Drinks / Other.
					*/}
					<div className="flex flex-wrap gap-2 text-xs sm:text-sm">
						{[
							{ id: "ALL" as const, label: "All" },
							{ id: "FOOD" as const, label: "Food" },
							{ id: "DRINK" as const, label: "Drinks" },
							{ id: "OTHER" as const, label: "Other" },
						].map((cat) => {
							const isActive = activeCategory === cat.id;
							return (
								<button
									key={cat.id}
									type="button"
									onClick={() => setActiveCategory(cat.id)}
									className={`rounded-full border px-3 py-1.5 font-medium transition ${isActive
										? "border-white/80 bg-white text-neutral-900"
										: "border-white/15 bg-white/5 text-neutral-200 hover:border-white/40 hover:text-white"
										}`}
								>
									{cat.label}
								</button>
							);
						})}
					</div>
				</div>
				{/* 
					Product grid tuned for touch:
					- 2 columns on phones and most tablets.
					- 3–4 columns only on larger desktop screens so each tile stays large.
				*/}
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
					{visibleProducts.map((p) => (
						<button
							key={p.id}
							type="button"
							onClick={() => handleAddProduct(p.id)}
							className="flex w-full min-h-[96px] flex-col items-start rounded-2xl border border-white/10 bg-black/30 p-3 sm:p-4 text-left shadow-sm shadow-black/40 transition hover:border-emerald-400/60 hover:bg-black/60 active:scale-[0.99]"
						>
							<div className="text-sm sm:text-base font-medium text-neutral-50">{p.name}</div>
							<div className="text-[10px] sm:text-xs uppercase tracking-[0.16em] text-neutral-500">
								{p.category}
							</div>
							<div className="mt-2 flex w-full items-baseline justify-between gap-2 text-sm sm:text-base text-neutral-100">
								<span>{formatCurrency(p.price)}</span>
								{typeof p.stock === "number" && (
									<span
										className={`text-[10px] sm:text-xs font-medium ${p.stock <= 0
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
