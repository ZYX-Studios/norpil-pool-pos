'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientTimer } from "../ClientTimer";
import { PayFormClient } from "./PayFormClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { updateSessionCustomerName, pauseSession, resumeSession, releaseTable } from "../actions";
import { CustomerSearchDialog } from "../components/CustomerSearchDialog";

type ItemCategory = "FOOD" | "DRINK" | "OTHER" | "TABLE_TIME";

type SessionItem = {
	id: string;
	productId: string;
	name: string;
	category: ItemCategory;
	unitPrice: number;
	quantity: number;
	servedQuantity: number;
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
	isMember?: boolean;
	discountPercent?: number;
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

export function SessionClient(props: SessionClientProps & {
	sessionType?: "OPEN" | "FIXED";
	targetDurationMinutes?: number;
	isMoneyGame?: boolean;
	betAmount?: number;
	isPrepaid?: boolean;
	totalPaid?: number;

	orderStatus?: string;
	lastSubmittedItemCount?: number;
}) {
	const {
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
		accumulatedPausedTime,
		isTableSession,
		sessionType,
		targetDurationMinutes,
		isMoneyGame,
		betAmount,
		isPrepaid,

		orderStatus = "OPEN",
		lastSubmittedItemCount = 0,
		isMember = false,
		discountPercent = 0,
		totalPaid = 0,
	} = props;
	const [renameSearchOpen, setRenameSearchOpen] = useState(false);
	// ... component state ...
	const router = useRouter();
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);
	const [items, setItems] = useState<SessionItem[]>(initialItems);
	const [productList, setProductList] = useState<SessionProduct[]>(products);
	const [activeCategory, setActiveCategory] = useState<ItemCategory | "ALL">("ALL");
	const [stockWarning, setStockWarning] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [now, setNow] = useState(() => Date.now());

	// Track submitted count locally for optimistic updates, syncing with server prop
	const [submittedCount, setSubmittedCount] = useState(lastSubmittedItemCount);
	useEffect(() => {
		setSubmittedCount(lastSubmittedItemCount);
	}, [lastSubmittedItemCount]);

	// Derived total quantity (sum of all items) to handle fragmented rows or duplicates correctly
	const totalQuantity = useMemo(() => items.reduce((sum, item) => sum + item.quantity, 0), [items]);

	useEffect(() => {
	}, [totalQuantity, submittedCount, items.length, orderStatus]);

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
					i.id === existing.id
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
					servedQuantity: 0,
					lineTotal: round2(product.price * targetQty),
					taxRate: product.taxRate,
				},
			];
		});

		startTransition(() => {
			void syncAddItem(orderId, productId, targetQty, supabase);
		});
	}

	function handleChangeQuantity(productId: string, nextQty: number) {
		// ... existing handleChangeQuantity ...
		setItems((prev) => {
			const existing = prev.find((i) => i.productId === productId);
			if (!existing) return prev;

			// Protection: Cannot reduce below served quantity
			if (nextQty < existing.servedQuantity) {
				return prev;
			}

			if (nextQty <= 0) {
				return prev.filter((i) => i.id !== existing.id);
			}
			return prev.map((i) =>
				i.id === existing.id
					? { ...i, quantity: nextQty, lineTotal: round2(nextQty * i.unitPrice) }
					: i,
			);
		});

		startTransition(() => {
			void syncUpdateQuantity(orderId, productId, nextQty, supabase);
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
											onClick={() => setRenameSearchOpen(true)}
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
					{isMember && discountPercent > 0 && (
						<div className="mb-3 -mt-2 flex items-center gap-2">
							<span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-medium text-emerald-300 border border-emerald-500/30">
								Member Price ({discountPercent}% Off)
							</span>
						</div>
					)}
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
										disabled={i.quantity <= i.servedQuantity}
										className={`flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-neutral-900 text-base font-semibold shadow-sm shadow-black/40 transition active:scale-95 ${i.quantity <= i.servedQuantity
											? "text-neutral-600 cursor-not-allowed border-neutral-800"
											: "text-neutral-50 hover:bg-neutral-50 hover:text-neutral-900"
											}`}
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

					{/* Send to Kitchen Action */}
					{/* 
						Smart Send Button:
						- Enabled if there are items AND (status is OPEN OR there are new items to send).
						- We filter out TABLE_TIME from the count strictly speaking, but for now raw length is fine 
						  as long as we track it consistently. Actually, let's just use raw items length.
					*/}
					<button
						disabled={totalQuantity <= submittedCount || items.length === 0}
						onClick={() => {
							import("../actions").then(async ({ sendOrderToKitchen }) => {
								const res = await sendOrderToKitchen(sessionId);
								if (res.success) {
									setSubmittedCount(totalQuantity); // Optimistic update
									router.refresh();
									// Simple toast/alert for now
									const btn = document.getElementById('kitchen-btn');
									if (btn) {
										const originalText = btn.innerText;
										btn.innerText = "Sent!";
										setTimeout(() => btn.innerText = "Send Order to Kitchen", 2000);
									}
								} else {
									alert("Failed to send: " + res.error);
								}
							});
						}}
						id="kitchen-btn"
						className={`w-full flex items-center justify-center gap-2 rounded-xl border py-3 text-sm font-bold transition-all ${(totalQuantity <= submittedCount || items.length === 0)
							? "bg-neutral-800 border-neutral-700 text-neutral-500 cursor-not-allowed"
							: "bg-blue-600/20 border-blue-500/30 text-blue-400 hover:bg-blue-600/30 active:scale-[0.98]"
							}`}
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
							<path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
						</svg>
						{(totalQuantity > submittedCount)
							? (orderStatus === 'SERVED' ? "Send New Items" : "Send Order to Kitchen")
							: (orderStatus === 'PREPARING' ? "Preparing..." :
								orderStatus === 'READY' ? "Order Ready" :
									items.length === 0 ? "Add Items to Start" : "Order Sent")
						}
					</button>
				</div>

				<PayFormClient
					sessionId={sessionId}
					suggestedAmount={grandTotal}
					totalPaid={totalPaid ?? 0}
					errorCode={errorCode}
				/>
			</section >

			<CustomerSearchDialog
				isOpen={renameSearchOpen}
				onClose={() => setRenameSearchOpen(false)}
				onSelectCustomer={(res) => {
					startTransition(async () => {
						await updateSessionCustomerName(sessionId, res.name, res.id);
						setRenameSearchOpen(false);
					});
				}}
			/>


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
		</div >
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
		console.error("Failed to sync add item", error);
		alert("Failed to add item. Check connection.");
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
		console.error("Failed to sync quantity change", error);
		alert("Failed to update quantity. Check connection.");
	}
}
