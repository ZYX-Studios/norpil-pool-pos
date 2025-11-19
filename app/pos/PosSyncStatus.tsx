'use client';

import { useEffect, useState } from "react";
import { useSyncManager } from "@/lib/offline/useSyncManager";

/**
 * Small status pill shown in the POS header.
 * - Triggers background syncs using the offline sync manager.
 * - Gives staff a quick glance at whether the device is online and synced.
 *
 * To keep SSR and client HTML in sync and avoid hook order issues, this component
 * renders nothing on the server and during the initial client render. Once mounted
 * on the client, it shows the live sync status using a nested component.
 */
export function PosSyncStatus() {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	if (!mounted) {
		// Render no markup during SSR and first client render.
		return null;
	}

	return <PosSyncStatusInner />;
}

function PosSyncStatusInner() {
	const { isOnline, status, lastFullSyncAt, errorMessage, syncNow } = useSyncManager();

	const isSyncing = status === "syncing";
	const isError = status === "error";

	let label = isOnline ? "Online" : "Offline";
	if (isSyncing) label = "Syncing…";
	if (isError) label = "Sync error";

	return (
		<button
			type="button"
			onClick={() => syncNow()}
			className={`rounded-full border px-3 py-1 text-[11px] font-medium ${
				isError
					? "border-red-400/60 bg-red-500/10 text-red-200"
					: isSyncing
						? "border-emerald-400/60 bg-emerald-500/20 text-emerald-100"
						: isOnline
							? "border-emerald-400/40 bg-emerald-500/10 text-emerald-100"
							: "border-amber-400/50 bg-amber-500/10 text-amber-100"
			}`}
		>
			<span>{label}</span>
			{lastFullSyncAt && !isError && (
				<span className="ml-2 text-[10px] opacity-75">
					Synced {new Date(lastFullSyncAt).toLocaleTimeString()}
				</span>
			)}
			{isError && errorMessage && (
				<span className="ml-2 max-w-[120px] truncate text-[9px] opacity-80">{errorMessage}</span>
			)}
		</button>
	);
}


