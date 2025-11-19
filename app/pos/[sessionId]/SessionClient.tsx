'use client';

import { useEffect, useMemo, useState, useTransition } from "react";
import { ClientTimer } from "../ClientTimer";
import { PayFormClient } from "./PayFormClient";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

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
	products: SessionProduct[];
	errorCode?: string;
};

// Helper to keep money values to 2 decimal places.
function round2(n: number) {
	return Number(n.toFixed(2));
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, {
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
	const [stockWarning, setStockWarning] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const { subtotal, taxTotal, itemsTotal } = useMemo(() => computeTotals(items), [items]);
	const billedHours = useMemo(() => computeBilledHours(openedAt, now), [openedAt, now]);
	const tableFee = useMemo(() => round2(billedHours * hourlyRate), [billedHours, hourlyRate]);
	const grandTotal = useMemo(() => round2(itemsTotal + tableFee), [itemsTotal, tableFee]);

	// Optimistically add or increase an item in the cart.
	function handleAddProduct(productId: string) {
		const product = products.find((p) => p.id === productId);
		if (!product) return;

		// Soft stock warning: if this product appears out of stock, we still
		// allow adding it but show a gentle warning to the staff.
		if (typeof product.stock === "number" && product.stock <= 0) {
			setStockWarning(`“${product.name}” is out of stock in inventory. Please confirm before serving.`);
		}

		setItems((prev) => {
			const existing = prev.find((i) => i.productId === productId);
			if (existing) {
				const nextQty = existing.quantity + 1;
				return prev.map((i) =>
					i.productId === productId
						? { ...i, quantity: nextQty, lineTotal: round2(nextQty * i.unitPrice) }
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
					quantity: 1,
					lineTotal: round2(product.price),
					taxRate: product.taxRate,
				},
			];
		});

		// Persist in the background. UI stays snappy even if the network is slow.
		startTransition(() => {
			void syncAddItem(orderId, productId, supabase);
		});
	}

	// Optimistically update quantity (or remove) for an item.
	function handleChangeQuantity(productId: string, nextQty: number) {
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
			void syncUpdateQuantity(orderId, productId, nextQty, supabase);
		});
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
					<div className="mb-2 flex items-center justify-between">
						<h2 className="text-sm font-semibold text-neutral-50">Cart</h2>
						{isPending && (
							<span className="text-[10px] text-neutral-400">Syncing…</span>
						)}
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

				<PayFormClient sessionId={sessionId} suggestedAmount={grandTotal} errorCode={errorCode} />
			</section>

			<section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-neutral-100 shadow-sm shadow-black/40 backdrop-blur lg:col-span-8">
				<div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
					<div>
						<h2 className="text-sm font-semibold text-neutral-50">Products</h2>
						<p className="text-xs text-neutral-400">Tap to add to this table’s order.</p>
					</div>
				</div>
				<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
					{products
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
											className={`text-[10px] font-medium ${
												p.stock <= 0
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
async function syncAddItem(orderId: string, productId: string, supabase: ReturnType<typeof createSupabaseBrowserClient>) {
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
}

// Persist quantity change (or delete) using Supabase from the browser.
async function syncUpdateQuantity(
	orderId: string,
	productId: string,
	nextQty: number,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
) {
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
}


