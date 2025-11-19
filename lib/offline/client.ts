import { getOfflineDb, createLocalId } from "./db";

/**
 * Lightweight types for the offline layer. These are intentionally generic
 * so they can be reused by different screens without tight coupling.
 */
export type OfflineProduct = {
	id: string;
	name: string;
	category: string;
	price: number;
	taxRate: number;
	stock: number | null;
};

export type SyncOperationType = "sale_created";

/**
 * Shape of a queued sale operation.
 * This is intentionally small: the server can still recompute totals
 * using its own business rules when the queue is replayed.
 */
export interface SaleCreatedPayload {
	sessionId: string;
	method: "CASH" | "GCASH" | "CARD" | "OTHER";
	tenderedAmount: number;
	suggestedAmount: number;
	capturedAt: string;
}

export interface SyncOperationPayloads {
	// In the first version, we only support pushing completed sales.
	sale_created: SaleCreatedPayload;
}

export type SyncQueueItem<T extends SyncOperationType = SyncOperationType> = {
	id: string;
	type: T;
	payload: SyncOperationPayloads[T];
	status: "pending" | "synced" | "failed";
	errorMessage?: string;
	createdAt: string;
	updatedAt: string;
	deviceId: string;
};

/**
 * Ensure we have a stable device id stored in the offline settings store.
 * This id lets us track which physical device generated which operations.
 */
export async function getOrCreateDeviceId(): Promise<string> {
	const db = await getOfflineDb();
	const tx = db.transaction("offlineSettings", "readwrite");
	const store = tx.objectStore("offlineSettings");
	const existing = await store.get("default");

	if (existing?.deviceId) {
		return existing.deviceId;
	}

	const deviceId = createLocalId("device");
	const settings = {
		deviceId,
		lastFullSyncAt: null,
		schemaVersion: 1,
	};
	await store.put(settings, "default");
	await tx.done;
	return deviceId;
}

export async function setLastFullSyncAt(isoTimestamp: string) {
	const db = await getOfflineDb();
	const tx = db.transaction("offlineSettings", "readwrite");
	const store = tx.objectStore("offlineSettings");
	const existing = (await store.get("default")) ?? {
		deviceId: createLocalId("device"),
		lastFullSyncAt: null,
		schemaVersion: 1,
	};
	await store.put(
		{
			...existing,
			lastFullSyncAt: isoTimestamp,
		},
		"default",
	);
	await tx.done;
}

export async function getLastFullSyncAt(): Promise<string | null> {
	const db = await getOfflineDb();
	const settings = await db.get("offlineSettings", "default");
	return settings?.lastFullSyncAt ?? null;
}

/**
 * Replace cached products with the provided list.
 * - Called after we fetch fresh products from Supabase.
 * - Kept simple: write-all approach is easier to reason about than merging.
 */
export async function saveProducts(products: OfflineProduct[]): Promise<void> {
	const db = await getOfflineDb();
	const tx = db.transaction("cachedProducts", "readwrite");
	const store = tx.objectStore("cachedProducts");

	// Clear old entries so we do not keep stale products.
	await store.clear();

	const now = new Date().toISOString();
	for (const p of products) {
		await store.put(
			{
				...p,
				stock: typeof p.stock === "number" ? p.stock : null,
				updatedAt: now,
			},
			p.id,
		);
	}

	await tx.done;
}

export async function getProducts(): Promise<OfflineProduct[]> {
	const db = await getOfflineDb();
	const values = await db.getAll("cachedProducts");
	return values.map((v) => ({
		id: v.id,
		name: v.name,
		category: v.category,
		price: v.price,
		taxRate: v.taxRate,
		stock: typeof v.stock === "number" ? v.stock : null,
	}));
}

/**
 * Enqueue a sync operation for later replay when the device is online.
 * Returns the local operation id so the caller can track it if needed.
 */
export async function enqueueOperation<T extends SyncOperationType>(
	type: T,
	payload: SyncOperationPayloads[T],
): Promise<string> {
	const db = await getOfflineDb();
	const deviceId = await getOrCreateDeviceId();
	const id = createLocalId(type);
	const now = new Date().toISOString();

	const item: SyncQueueItem<T> = {
		id,
		type,
		payload,
		status: "pending",
		createdAt: now,
		updatedAt: now,
		deviceId,
	};

	const tx = db.transaction("syncQueue", "readwrite");
	await tx.store.put(item, id);
	await tx.done;

	return id;
}

/**
 * Convenience wrapper for the common "sale created" operation.
 * The POS payment flow will call this when we introduce true offline
 * payments so that completed sales are queued for later sync.
 */
export async function queueSaleCreated(payload: SaleCreatedPayload): Promise<string> {
	return enqueueOperation("sale_created", payload);
}

export async function getPendingOperations(): Promise<SyncQueueItem[]> {
	const db = await getOfflineDb();
	const all = await db.getAll("syncQueue");
	return all
		.filter((item) => item.status === "pending")
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function markOperationSynced(id: string): Promise<void> {
	const db = await getOfflineDb();
	const tx = db.transaction("syncQueue", "readwrite");
	const store = tx.objectStore("syncQueue");
	const existing = await store.get(id);
	if (!existing) {
		return;
	}
	await store.put(
		{
			...existing,
			status: "synced",
			errorMessage: undefined,
			updatedAt: new Date().toISOString(),
		},
		id,
	);
	await tx.done;
}

export async function markOperationFailed(id: string, errorMessage: string): Promise<void> {
	const db = await getOfflineDb();
	const tx = db.transaction("syncQueue", "readwrite");
	const store = tx.objectStore("syncQueue");
	const existing = await store.get(id);
	if (!existing) {
		return;
	}
	await store.put(
		{
			...existing,
			status: "failed",
			errorMessage,
			updatedAt: new Date().toISOString(),
		},
		id,
	);
	await tx.done;
}


