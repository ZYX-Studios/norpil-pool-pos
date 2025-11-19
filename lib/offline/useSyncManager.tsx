'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
	getOrCreateDeviceId,
	getProducts,
	saveProducts,
	setLastFullSyncAt,
	getLastFullSyncAt,
	type OfflineProduct,
} from "./client";

export type SyncStatus = "idle" | "syncing" | "error";

export type SyncState = {
	isOnline: boolean;
	status: SyncStatus;
	lastFullSyncAt: string | null;
	errorMessage: string | null;
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

	const runSync = useCallback(async () => {
		if (!isOnline) return;
		setStatus("syncing");
		setErrorMessage(null);

		try {
			// Ensure we have a device id for tracking and future server-side diagnostics.
			await getOrCreateDeviceId();

			// Downstream: refresh products from Supabase into the local cache.
			await syncDownProducts(supabase);

			// Upstream (syncQueue -> Supabase) will be wired in a later step.

			const now = new Date().toISOString();
			await setLastFullSyncAt(now);
			setLastFullSyncAtState(now);
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


