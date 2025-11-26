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
	type SessionOpenedPayload,
} from "./client";
import { closeSessionAndRecordPayment } from "@/lib/payments/closeSession";
import { getServerIdForLocal, saveIdMapping } from "./client";

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
	const [isOnline, setIsOnline] = useState(true);
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

			// Upstream: replay any queued operations (e.g. offline cart changes).
			// We do this FIRST so that we do not overwrite local changes with stale server data.
			await syncUpOperations(supabase);

			// Downstream: refresh products from Supabase into the local cache.
			await syncDownProducts(supabase);

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
 *
 * IMPROVEMENT: We now track failed local IDs to skip dependent operations.
 */
async function syncUpOperations(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
	const ops = await getPendingOperations();
	if (ops.length === 0) return;

	// Keep track of local IDs that failed to sync or map, so we can skip
	// dependent operations (e.g. don't add items to a session that failed to open).
	const failedLocalIds = new Set<string>();

	for (const op of ops as SyncQueueItem[]) {
		// Check dependencies
		if (hasFailedDependency(op, failedLocalIds)) {
			await markOperationFailed(op.id, "Skipped due to failed dependency.");
			continue;
		}

		try {
			switch (op.type as SyncOperationType) {
				case "session_opened": {
					const payload = op.payload as SessionOpenedPayload;
					try {
						await applySessionOpened(payload, supabase);
						await markOperationSynced(op.id);
					} catch (err) {
						// If session open fails, we must block all future ops for this session/order
						failedLocalIds.add(payload.localSessionId);
						failedLocalIds.add(payload.localOrderId);
						throw err;
					}
					break;
				}
				case "order_item_set_quantity": {
					const payload = op.payload as OrderItemSetQuantityPayload;
					// If the order ID is local and in our failed set, we skip.
					// (This is also caught by hasFailedDependency, but good to be explicit)
					if (failedLocalIds.has(payload.orderId)) {
						throw new Error(`Skipped because order ${payload.orderId} failed to sync.`);
					}
					await applyOrderItemSetQuantity(payload, supabase);
					await markOperationSynced(op.id);
					break;
				}
				case "sale_created": {
					const payload = op.payload as SaleCreatedPayload;
					if (failedLocalIds.has(payload.sessionId)) {
						throw new Error(`Skipped because session ${payload.sessionId} failed to sync.`);
					}
					await applySaleCreated(payload, supabase);
					await markOperationSynced(op.id);
					break;
				}
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
 * Helper to check if an operation depends on a local ID that has already failed.
 */
function hasFailedDependency(op: SyncQueueItem, failedIds: Set<string>): boolean {
	if (failedIds.size === 0) return false;

	if (op.type === "order_item_set_quantity") {
		const p = op.payload as OrderItemSetQuantityPayload;
		return failedIds.has(p.orderId);
	}
	if (op.type === "sale_created") {
		const p = op.payload as SaleCreatedPayload;
		return failedIds.has(p.sessionId);
	}
	// session_opened defines the IDs, so it doesn't depend on others (usually).
	return false;
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
	let { orderId, productId, nextQty } = payload;

	// If this operation was recorded against a local-only order id created
	// while offline, translate it to the real server id using the mapping
	// created when the associated session_opened operation was synced.
	if (orderId.startsWith("order_")) {
		const mapped = await getServerIdForLocal(orderId, "order");
		if (!mapped) {
			throw new Error(`No server order mapping found for local order id ${orderId}`);
		}
		orderId = mapped;
	}

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
	let { sessionId, method, tenderedAmount } = payload;

	// Translate local-only session ids (created while offline) into their
	// corresponding server ids before delegating to the shared helper.
	if (sessionId.startsWith("session_")) {
		const mapped = await getServerIdForLocal(sessionId, "table_session");
		if (!mapped) {
			throw new Error(`No server session mapping found for local session id ${sessionId}`);
		}
		sessionId = mapped;
	}
	await closeSessionAndRecordPayment(supabase as any, {
		sessionId,
		method,
		tenderedAmount,
	});
}

/**
 * Apply a queued "session opened" operation by creating a real table_session
 * and an initial OPEN order in Supabase, then recording how the local ids map
 * to the new server ids. This lets later queued operations that reference the
 * local ids be safely translated during sync.
 *
 * Idempotency: before inserting anything we check whether a mapping already
 * exists for the local session id. If it does, we treat this operation as
 * already applied and return early so replays are safe.
 */
async function applySessionOpened(
	payload: SessionOpenedPayload,
	supabase: ReturnType<typeof createSupabaseBrowserClient>,
) {
	const { localSessionId, localOrderId, poolTableId, openedAt, overrideHourlyRate } = payload;

	// If we already know the server id for this local session, there is
	// nothing left to do. This makes the operation safe to replay.
	const existingServerSessionId = await getServerIdForLocal(localSessionId, "table_session");
	if (existingServerSessionId) {
		return;
	}

	// Create the real table session on the server.
	const { data: session, error: sessionErr } = await supabase
		.from("table_sessions")
		.insert({
			pool_table_id: poolTableId,
			status: "OPEN",
			opened_at: openedAt,
			override_hourly_rate: overrideHourlyRate,
			customer_name: payload.customerName,
		})
		.select("id")
		.single();
	if (sessionErr || !session?.id) {
		throw sessionErr ?? new Error("Failed to create table session during sync.");
	}

	// Create the initial OPEN order for this session.
	const { data: order, error: orderErr } = await supabase
		.from("orders")
		.insert({
			table_session_id: session.id,
			status: "OPEN",
		})
		.select("id")
		.single();
	if (orderErr || !order?.id) {
		throw orderErr ?? new Error("Failed to create order for table session during sync.");
	}

	// Remember how the local ids map to the server ids so future operations
	// that reference the local ids can be translated correctly.
	await saveIdMapping({
		localId: localSessionId,
		kind: "table_session",
		serverId: session.id as string,
	});
	await saveIdMapping({
		localId: localOrderId,
		kind: "order",
		serverId: order.id as string,
	});
}


