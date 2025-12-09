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

export type SyncOperationType = "sale_created" | "order_item_set_quantity" | "session_opened";

/**
 * Shape of a queued sale operation.
 * This is intentionally small: the server can still recompute totals
 * using its own business rules when the queue is replayed.
 */
export interface SaleCreatedPayload {
	sessionId: string;
	method: "CASH" | "GCASH" | "CARD" | "WALLET" | "OTHER";
	tenderedAmount: number;
	suggestedAmount: number;
	capturedAt: string;
}

export interface OrderItemSetQuantityPayload {
	orderId: string;
	productId: string;
	nextQty: number;
}

export interface SessionOpenedPayload {
	localSessionId: string;
	localOrderId: string;
	poolTableId: string | null;
	openedAt: string;
	overrideHourlyRate: number | null;
	customerName?: string | null;
}

export interface SyncOperationPayloads {
	// In the first version, we only support pushing completed sales.
	sale_created: SaleCreatedPayload;
	order_item_set_quantity: OrderItemSetQuantityPayload;
	session_opened: SessionOpenedPayload;
}

export type OfflineTable = {
	id: string;
	name: string;
	isActive: boolean;
	hourlyRate: number;
};

export type OfflineTableSession = {
	id: string;
	poolTableId: string | null;
	openedAt: string;
	overrideHourlyRate: number | null;
	itemsTotal: number;
	status: "OPEN" | "CLOSED";
	customerName?: string | null;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
};

export type OfflineSessionItem = {
	productId: string;
	name: string;
	category: string;
	unitPrice: number;
	quantity: number;
	lineTotal: number;
	taxRate: number;
};

export type OfflineSessionSnapshot = {
	sessionId: string;
	tableName: string;
	openedAt: string;
	hourlyRate: number;
	orderId: string;
	items: OfflineSessionItem[];
	customerName?: string | null;
};

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
 * Cache the current tables + open sessions snapshot used by the /pos home screen.
 * This allows us to show the last known state when the device is offline.
 */
export async function saveTablesSnapshot(args: {
	tables: OfflineTable[];
	sessions: OfflineTableSession[];
}): Promise<void> {
	const db = await getOfflineDb();
	const now = new Date().toISOString();

	const tablesTx = db.transaction("tables", "readwrite");
	await tablesTx.store.clear();
	for (const t of args.tables) {
		await tablesTx.store.put(
			{
				id: t.id,
				name: t.name,
				isActive: t.isActive,
				hourlyRate: t.hourlyRate,
				updatedAt: now,
			},
			t.id,
		);
	}
	await tablesTx.done;

	const sessionsTx = db.transaction("tableSessions", "readwrite");
	await sessionsTx.store.clear();
	for (const s of args.sessions) {
		await sessionsTx.store.put(
			{
				id: s.id,
				poolTableId: s.poolTableId ?? "", // Fallback for indexeddb index if needed, or handle null
				openedAt: s.openedAt,
				overrideHourlyRate: s.overrideHourlyRate,
				itemsTotal: s.itemsTotal,
				status: s.status,
				customerName: s.customerName,
				updatedAt: now,
			},
			s.id,
		);
	}
	await sessionsTx.done;
}

export async function getTablesSnapshot(): Promise<{
	tables: OfflineTable[];
	sessions: OfflineTableSession[];
}> {
	const db = await getOfflineDb();

	const [tablesRaw, sessionsRaw] = await Promise.all([
		db.getAll("tables"),
		db.getAll("tableSessions"),
	]);

	const tables: OfflineTable[] = tablesRaw.map((t) => ({
		id: t.id,
		name: t.name,
		isActive: t.isActive,
		hourlyRate: t.hourlyRate,
	}));

	const sessions: OfflineTableSession[] = sessionsRaw.map((s) => ({
		id: s.id,
		poolTableId: s.poolTableId,
		openedAt: s.openedAt,
		overrideHourlyRate: s.overrideHourlyRate,
		itemsTotal: s.itemsTotal,
		status: s.status,
		customerName: s.customerName,
	}));

	return { tables, sessions };
}

/**
 * Store a per-session order snapshot so that /pos/[sessionId] can render
 * recent data even when the server is unreachable.
 */
export async function saveSessionSnapshot(snapshot: OfflineSessionSnapshot): Promise<void> {
	const db = await getOfflineDb();
	const tx = db.transaction("sessionSnapshots", "readwrite");
	const now = new Date().toISOString();

	await tx.store.put(
		{
			sessionId: snapshot.sessionId,
			tableName: snapshot.tableName,
			openedAt: snapshot.openedAt,
			hourlyRate: snapshot.hourlyRate,
			orderId: snapshot.orderId,
			items: snapshot.items,
			customerName: snapshot.customerName,
			updatedAt: now,
		},
		snapshot.sessionId,
	);

	await tx.done;
}

export async function getSessionSnapshot(sessionId: string): Promise<OfflineSessionSnapshot | null> {
	const db = await getOfflineDb();
	const row = await db.get("sessionSnapshots", sessionId);
	if (!row) return null;

	return {
		sessionId: row.sessionId,
		tableName: row.tableName,
		openedAt: row.openedAt,
		hourlyRate: row.hourlyRate,
		orderId: row.orderId,
		items: row.items,
		customerName: row.customerName,
	};
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

export async function queueOrderItemSetQuantity(payload: OrderItemSetQuantityPayload): Promise<string> {
	return enqueueOperation("order_item_set_quantity", payload);
}

export async function queueSessionOpened(payload: SessionOpenedPayload): Promise<string> {
	return enqueueOperation("session_opened", payload);
}

export async function getPendingOperations(): Promise<SyncQueueItem[]> {
	const db = await getOfflineDb();
	const all = await db.getAll("syncQueue");
	return all
		.filter((item) => item.status === "pending")
		.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) as SyncQueueItem[];
}

/**
 * Return all operations that have permanently failed to sync.
 * - We keep this separate from the "pending" queue so the UI can surface
 *   a gentle warning without blocking normal sync behaviour.
 */
export async function getFailedOperations(): Promise<SyncQueueItem[]> {
	const db = await getOfflineDb();
	const all = await db.getAll("syncQueue");
	return all
		.filter((item) => item.status === "failed")
		.sort((a, b) => a.updatedAt.localeCompare(b.updatedAt)) as SyncQueueItem[];
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

/**
 * Store a mapping between a local-only id (created while offline) and the
 * real server id once sync has created the record in Supabase. This allows
 * queued operations that reference local ids to be safely translated before
 * they are applied upstream.
 */
export async function saveIdMapping(args: {
	localId: string;
	kind: "table_session" | "order";
	serverId: string;
}): Promise<void> {
	const db = await getOfflineDb();
	const tx = db.transaction("idMappings", "readwrite");
	const now = new Date().toISOString();
	await tx.store.put(
		{
			localId: args.localId,
			kind: args.kind,
			serverId: args.serverId,
			createdAt: now,
		},
		`${args.kind}:${args.localId}`,
	);
	await tx.done;
}

/**
 * Look up the server id that corresponds to a local-only id created while
 * offline. Returns null if there is no known mapping yet.
 */
export async function getServerIdForLocal(
	localId: string,
	kind: "table_session" | "order",
): Promise<string | null> {
	const db = await getOfflineDb();
	const row = await db.get("idMappings", `${kind}:${localId}`);
	return row?.serverId ?? null;
}


