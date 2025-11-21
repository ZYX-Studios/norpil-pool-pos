import { openDB, type DBSchema, type IDBPDatabase } from "idb";

/**
 * Schema for the local offline database.
 * We keep this small and focused on what the POS truly needs offline.
 */
interface PosOfflineDb extends DBSchema {
	offlineSettings: {
		key: string;
		value: {
			deviceId: string;
			lastFullSyncAt: string | null;
			schemaVersion: number;
		};
	};
	cachedProducts: {
		key: string;
		value: {
			id: string;
			name: string;
			category: string;
			price: number;
			taxRate: number;
			stock: number | null;
			// Updated timestamp helps us decide if we should refresh from the server.
			updatedAt: string;
		};
	};
	cachedInventory: {
		key: string;
		value: {
			productId: string;
			locationId: string | null;
			availableQty: number;
			updatedAt: string;
		};
	};
	offlineSales: {
		key: string;
		value: {
			// Local-only id so we can link header, items, and payments.
			localId: string;
			// Optional server id once the sale is synced.
			serverId?: string;
			payload: unknown;
			createdAt: string;
			syncedAt: string | null;
		};
	};
	syncQueue: {
		key: string;
		value: {
			id: string;
			type: string;
			// Generic payload; caller is responsible for shape.
			payload: unknown;
			status: "pending" | "synced" | "failed";
			errorMessage?: string;
			createdAt: string;
			updatedAt: string;
			deviceId: string;
		};
	};
	tables: {
		key: string;
		value: {
			id: string;
			name: string;
			isActive: boolean;
			hourlyRate: number;
			updatedAt: string;
		};
	};
	tableSessions: {
		key: string;
		value: {
			id: string;
			poolTableId: string;
			openedAt: string;
			overrideHourlyRate: number | null;
			itemsTotal: number;
			status: "OPEN" | "CLOSED";
			updatedAt: string;
		};
	};
	sessionSnapshots: {
		key: string;
		value: {
			sessionId: string;
			tableName: string;
			openedAt: string;
			hourlyRate: number;
			orderId: string;
			items: Array<{
				productId: string;
				name: string;
				category: string;
				unitPrice: number;
				quantity: number;
				lineTotal: number;
				taxRate: number;
			}>;
			updatedAt: string;
		};
	};
}

let dbPromise: Promise<IDBPDatabase<PosOfflineDb>> | null = null;

/**
 * Open (or create) the IndexedDB database used for offline POS state.
 *
 * This function is safe to call multiple times. It lazily creates a single
 * shared promise so all callers reuse the same connection.
 */
export function getOfflineDb() {
	if (!dbPromise) {
		// Guard for non-browser environments (Server Components, SSR).
		if (typeof indexedDB === "undefined") {
			// In server contexts we simply throw, so callers can decide how to handle it.
			throw new Error("IndexedDB is not available in this environment.");
		}

		dbPromise = openDB<PosOfflineDb>("norpil-pos-offline", 3, {
			upgrade(db, oldVersion) {
				// Initial version with core offline stores.
				if (oldVersion < 1) {
					db.createObjectStore("offlineSettings");
					db.createObjectStore("cachedProducts");
					db.createObjectStore("cachedInventory");
					db.createObjectStore("offlineSales");
					db.createObjectStore("syncQueue");
				}
				// Version 2 adds cached tables + open sessions snapshot for /pos.
				if (oldVersion < 2) {
					db.createObjectStore("tables");
					db.createObjectStore("tableSessions");
				}
				// Version 3 adds per-session order snapshots for /pos/[sessionId].
				if (oldVersion < 3) {
					db.createObjectStore("sessionSnapshots");
				}
			},
		});
	}

	return dbPromise;
}

/**
 * Simple helper to generate a local id using timestamp + randomness.
 * This keeps ids short, readable, and unique enough for offline usage.
 */
export function createLocalId(prefix: string) {
	const now = Date.now().toString(36);
	const rand = Math.random().toString(36).slice(2, 8);
	return `${prefix}_${now}_${rand}`;
}



