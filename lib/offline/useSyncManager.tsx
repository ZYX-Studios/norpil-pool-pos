'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
	getOrCreateDeviceId,
	getProducts,
	saveProducts,
	setLastFullSyncAt,
	getLastFullSyncAt,
	getPendingOperations,
	getFailedOperations,
	markOperationFailed,
	markOperationSynced,
	type OfflineProduct,
	type SyncQueueItem,
	type SyncOperationType,
	type OrderItemSetQuantityPayload,
	type SaleCreatedPayload,
} from "./client";
import { closeSessionAndRecordPayment } from "@/lib/payments/closeSession";

export type SyncStatus = "idle" | "syncing" | "error";

export type SyncState = {
	isOnline: boolean;
	status: SyncStatus;
	lastFullSyncAt: string | null;
	errorMessage: string | null;
	// Number of operations that could not be synced to the server.
	// This lets the header surface a gentle warning without blocking
	// normal sync behaviour.
	failedCount: number;
	syncNow: () => void;
};

/**
 * Hook that keeps the offline cache in sync with Supabase when possible.
 * - Listens for online/offline events.
 * - On first mount (and when going back online) it pulls fresh products.
 * - Upstream sync of queued operations will be added on top of this base.
 */
export function useSyncManager(): SyncState {
	const supabase = useMemo(() => createSupabaseBrowserClient(), []);
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);
	const [status, setStatus] = useState<SyncStatus>("idle");
	const [lastFullSyncAt, setLastFullSyncAtState] = useState<string | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [failedCount, setFailedCount] = useState<number>(0);

	// Listen for browser connectivity changes so we can trigger syncs automatically.
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

	// Load last sync timestamp once on mount.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const ts = await getLastFullSyncAt();
				if (!cancelled) {
					setLastFullSyncAtState(ts);
				}
			} catch {
				// If IndexedDB is not ready yet we silently ignore it; the next
				// successful sync will update the timestamp.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Load any existing failed operations so the header can immediately
	// indicate if there are unsynced changes from previous sessions.
	useEffect(() => {
		let cancelled = false;
		void (async () => {
			try {
				const failed = await getFailedOperations();
				if (!cancelled) {
					setFailedCount(failed.length);
				}
			} catch {
				// If IndexedDB is unavailable we simply skip the indicator.
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	const runSync = useCallback(async () => {
		if (!isOnline) return;
		setStatus("syncing");
		setErrorMessage(null);

		try {
			// Ensure we have a device id for tracking and future server-side diagnostics.
			await getOrCreateDeviceId();

			// Downstream: refresh products from Supabase into the local cache.
			await syncDownProducts(supabase);

			// Upstream: replay any queued operations (e.g. offline cart changes).
			await syncUpOperations(supabase);

			const now = new Date().toISOString();
			await setLastFullSyncAt(now);
			setLastFullSyncAtState(now);
			// After a sync attempt, check if we still have failed operations.
			// If we do, we keep the status in "error" so staff see a clear
			// warning, but we still refresh the lastFullSyncAt timestamp.
			try {
				const failed = await getFailedOperations();
				setFailedCount(failed.length);
				if (failed.length > 0) {
					const last = failed[failed.length - 1];
					const lastMsg =
						typeof last.errorMessage === "string" && last.errorMessage.trim().length > 0
							? last.errorMessage
							: null;
					setStatus("error");
					setErrorMessage(
						lastMsg
							? `Some changes could not be synced (${failed.length} pending). Last error: ${lastMsg}`
							: `Some changes could not be synced (${failed.length} pending).`,
					);
					return;
				}
			} catch {
				// If we cannot inspect the queue, we still consider the sync
				// successful and leave failedCount unchanged.
			}

			setStatus("idle");
		} catch (err) {
			console.error("POS sync error", err);
			setStatus("error");

			// Normalise the error into a short, readable message.
			let msg = "Unable to sync. The server might be unreachable.";
			if (err instanceof Error && err.message) {
				msg = err.message;
			} else if (err && typeof err === "object" && "message" in err && typeof (err as any).message === "string") {
				msg = (err as any).message;
			}

			setErrorMessage(msg);
		}
	}, [isOnline, supabase]);

	// When we first mount and we are online, perform an initial sync in the background.
	useEffect(() => {
		if (!isOnline) return;
		// We intentionally do not await this here to avoid blocking rendering.
		void runSync();
	}, [isOnline, runSync]);

	return {
		isOnline,
		status,
		lastFullSyncAt,
		errorMessage,
		failedCount,
		syncNow: () => {
			void runSync();
		},
	};
}

/**
 * Fetch active products + stock from Supabase and replace the local cache.
 * This mirrors the core query used by the POS session page but runs on the client.
 */
async function syncDownProducts(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
	// Load active products.
	const { data: products, error: productsError } = await supabase
		.from("products")
		.select("id, name, category, price, tax_rate, is_active")
		.eq("is_active", true)
		.order("name", { ascending: true });

	if (productsError) {
		throw productsError;
	}

	// Load current stock snapshot for each product.
	const { data: stockRows, error: stockError } = await supabase
		.from("product_stock")
		.select("product_id, quantity_on_hand");

	if (stockError) {
		throw stockError;
	}

	const stockMap = new Map<string, number>();
	for (const row of stockRows ?? []) {
		const pid = (row as any).product_id as string;
		const qty = Number((row as any).quantity_on_hand ?? 0);
		if (!pid) continue;
		stockMap.set(pid, Number.isFinite(qty) ? qty : 0);
	}

	const offlineProducts: OfflineProduct[] = (products ?? []).map((p: any) => ({
		id: p.id as string,
		name: p.name as string,
		category: p.category as string,
		price: Number(p.price),
		taxRate: Number(p.tax_rate ?? 0),
		stock: stockMap.get(p.id as string) ?? null,
	}));

	await saveProducts(offlineProducts);

	// Optional: this call keeps the local cache warm in memory if needed.
	// We do not use its result directly here but it is handy for debugging.
	await getProducts();
}

/**
 * Replay queued offline operations (such as cart edits) to Supabase.
 * We process operations in creation order to preserve intent.
 */
async function syncUpOperations(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
	const ops = await getPendingOperations();
	if (ops.length === 0) return;

	for (const op of ops as SyncQueueItem[]) {
		try {
			switch (op.type as SyncOperationType) {
				case "order_item_set_quantity":
					await applyOrderItemSetQuantity(op.payload as OrderItemSetQuantityPayload, supabase);
					await markOperationSynced(op.id);
					break;
				case "sale_created":
					await applySaleCreated(op.payload as SaleCreatedPayload, supabase);
					await markOperationSynced(op.id);
					break;
				default:
					await markOperationFailed(op.id, `Unsupported operation type: ${op.type}`);
					break;
			}
		} catch (err) {
			const msg = err instanceof Error && err.message ? err.message : String(err);
			await markOperationFailed(op.id, msg);
		}
	}
}

/**
 * Apply a single "set quantity" operation for an order item.
 * - If the line does not exist and nextQty > 0, we insert it using the product price.
 * - If the line exists and nextQty > 0, we update quantity and line_total.
 * - If the line exists and nextQty <= 0, we delete it.
 */
async function applyOrderItemSetQuantity(
	payload: OrderItemSetQuantityPayload,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
) {
	const { orderId, productId, nextQty } = payload;

	// Look for an existing line on this order for the product.
	const { data: line, error: lineErr } = await supabase
		.from("order_items")
		.select("id, unit_price")
		.eq("order_id", orderId)
		.eq("product_id", productId)
		.maybeSingle();
	if (lineErr) throw lineErr;

	// If there is no existing line, we either do nothing (qty <= 0) or insert a new one.
	if (!line?.id) {
		if (nextQty <= 0) {
			return;
		}

		const { data: product, error: productErr } = await supabase
			.from("products")
			.select("price")
			.eq("id", productId)
			.maybeSingle();
		if (productErr) throw productErr;

		const unitPrice = Number(product?.price ?? 0);
		const safeQty = Math.max(0, Math.trunc(nextQty));
		const lineTotal = Number((unitPrice * safeQty).toFixed(2));

		const { error: insErr } = await supabase.from("order_items").insert({
			order_id: orderId,
			product_id: productId,
			quantity: safeQty,
			unit_price: unitPrice,
			line_total: lineTotal,
		});
		if (insErr) throw insErr;
		return;
	}

	// Existing line: if nextQty <= 0 delete; otherwise update quantity and total.
	if (nextQty <= 0) {
		const { error: delErr } = await supabase.from("order_items").delete().eq("id", line.id);
		if (delErr) throw delErr;
		return;
	}

	const safeQty = Math.max(0, Math.trunc(nextQty));
	const unitPrice = Number(line.unit_price ?? 0);
	const lineTotal = Number((unitPrice * safeQty).toFixed(2));

	const { error: updErr } = await supabase
		.from("order_items")
		.update({ quantity: safeQty, line_total: lineTotal })
		.eq("id", line.id);
	if (updErr) throw updErr;
}

/**
 * Apply a queued "sale created" operation by delegating to the shared
 * closeSessionAndRecordPayment helper. This will:
 * - Close the table session.
 * - Finalise TABLE_TIME.
 * - Compute final totals.
 * - Insert inventory movements for sold products.
 * - Insert a payment row and mark the order as PAID.
 *
 * Idempotency: the helper is written to be safe to call multiple times for
 * the same session/order, so we do not need additional guards here.
 */
async function applySaleCreated(
	payload: SaleCreatedPayload,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
) {
	const { sessionId, method, tenderedAmount } = payload;
	await closeSessionAndRecordPayment(supabase as any, {
		sessionId,
		method,
		tenderedAmount,
	});
}


