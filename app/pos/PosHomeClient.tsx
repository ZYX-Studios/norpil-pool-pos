'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientTimer } from "./ClientTimer";
import { openTableAction } from "./actions";
import {
	getTablesSnapshot,
	saveTablesSnapshot,
	queueSessionOpened,
	saveSessionSnapshot,
	type OfflineTable,
	type OfflineTableSession,
} from "@/lib/offline/client";
import { createLocalId } from "@/lib/offline/db";

type PoolTable = {
	id: string;
	name: string;
	is_active: boolean;
	hourly_rate: number;
};

type OpenSession = {
	id: string;
	pool_table_id: string;
	opened_at: string;
	override_hourly_rate: number | null;
};

type PosHomeClientProps = {
	initialTables: PoolTable[];
	initialSessions: OpenSession[];
	initialSessionTotals: Array<{ sessionId: string; itemsTotal: number }>;
	initialErrorCode: string | null;
};

/**
 * Client-side wrapper for the POS tables page.
 * - When online and initial data is present, we render it and cache a snapshot.
 * - When offline (or initial load fails), we fall back to the last cached snapshot.
 * - When fully offline, staff can still open new sessions using local ids and
 *   queued sync operations; these are turned into real sessions later.
 */
export function PosHomeClient({
	initialTables,
	initialSessions,
	initialSessionTotals,
	initialErrorCode,
}: PosHomeClientProps) {
	const router = useRouter();
	const [tables, setTables] = useState<PoolTable[]>(initialTables);
	const [openSessions, setOpenSessions] = useState<OpenSession[]>(initialSessions);
	const [sessionTotals, setSessionTotals] = useState<Map<string, number>>(() => {
		const map = new Map<string, number>();
		for (const { sessionId, itemsTotal } of initialSessionTotals) {
			map.set(sessionId, itemsTotal);
		}
		return map;
	});
	const [errorCode, setErrorCode] = useState<string | null>(initialErrorCode);
	const [isOnline, setIsOnline] = useState(true);

	// On mount, decide whether to use server data or fall back to cached snapshot.
	// Track basic online/offline status so we can choose between server actions
	// and purely local offline behaviour. If the initial server load already
	// failed with a network error (load_failed / open_table), we also treat the
	// POS as effectively offline so that actions like "Open table" use the
	// offline path instead of repeatedly calling the server action.
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

	// If the initial render already knows that the server could not be reached,
	// treat the device as offline for the purposes of POS actions. This covers
	// cases where the browser still reports navigator.onLine = true but the
	// Supabase backend is unreachable (e.g. internet gateway down).
	useEffect(() => {
		if (initialErrorCode === "load_failed" || initialErrorCode === "open_table") {
			setIsOnline(false);
		}
	}, [initialErrorCode]);

	useEffect(() => {
		let cancelled = false;

		void (async () => {
			// If we already have tables from the server, treat that as the source
			// of truth and also seed the offline snapshot.
			if (initialTables.length > 0) {
				try {
					const offlineTables: OfflineTable[] = initialTables.map((t) => ({
						id: t.id,
						name: t.name,
						isActive: t.is_active,
						hourlyRate: t.hourly_rate,
					}));

					const sessionTotalsArray: OfflineTableSession[] = initialSessions.map((s) => ({
						id: s.id,
						poolTableId: s.pool_table_id,
						openedAt: s.opened_at,
						overrideHourlyRate: s.override_hourly_rate,
						itemsTotal: sessionTotals.get(s.id) ?? 0,
						status: "OPEN",
					}));

					await saveTablesSnapshot({
						tables: offlineTables,
						sessions: sessionTotalsArray,
					});
				} catch {
					// If IndexedDB is unavailable (e.g. private mode), we still have live data.
				}
				return;
			}

			// No initial tables: try to load from the offline snapshot instead.
			try {
				const snapshot = await getTablesSnapshot();
				if (cancelled) return;

				if (snapshot.tables.length > 0) {
					const fallbackTables: PoolTable[] = snapshot.tables.map((t) => ({
						id: t.id,
						name: t.name,
						is_active: t.isActive,
						hourly_rate: t.hourlyRate,
					}));

					const fallbackSessions: OpenSession[] = snapshot.sessions
						.filter((s) => s.status === "OPEN")
						.map((s) => ({
							id: s.id,
							pool_table_id: s.poolTableId,
							opened_at: s.openedAt,
							override_hourly_rate: s.overrideHourlyRate,
						}));

					const totalsMap = new Map<string, number>();
					for (const s of snapshot.sessions) {
						totalsMap.set(s.id, s.itemsTotal);
					}

					setTables(fallbackTables);
					setOpenSessions(fallbackSessions);
					setSessionTotals(totalsMap);
					// We are showing cached data, so treat this as a degraded but
					// non-fatal state.
					setErrorCode((prev) => (prev === "load_failed" ? "cached_snapshot" : prev));
				}
			} catch {
				// If we cannot even read the snapshot, we keep the original errorCode
				// so staff still see that live data is not available.
			}
		})();

		return () => {
			cancelled = true;
		};
	}, [initialTables, initialSessions, initialSessionTotals, initialErrorCode, sessionTotals]);

	const tableIdToSession = useMemo(() => {
		const map = new Map<string, OpenSession>();
		for (const s of openSessions) {
			map.set(s.pool_table_id, s);
		}
		return map;
	}, [openSessions]);

	return (
		<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">Tables</h1>
					<p className="text-xs text-neutral-400">Open and manage live pool sessions seamlessly.</p>
				</div>
			</div>
			{errorCode && (
				<div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
					{errorCode === "load_failed"
						? "Unable to load live table data. You might be offline or the server is unreachable."
						: errorCode === "cached_snapshot"
							? "Showing the last known table data from this device. Some information may be out of date."
							: "The POS could not reach the server. Some actions may be temporarily unavailable."}
				</div>
			)}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{tables.map((t) => {
					const session = tableIdToSession.get(t.id);
					const orderItemsTotal = session ? sessionTotals.get(session.id) ?? 0 : 0;
					return (
						<div
							key={t.id}
							className={`group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur transition hover:border-emerald-400/60 hover:bg-white/10 ${session ? "ring-1 ring-emerald-500/40" : ""}`}
						>
							<div className="mb-3 flex items-center justify-between">
								<div className="text-sm font-medium text-neutral-50 sm:text-base">{t.name}</div>
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${session ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/60 text-neutral-200"}`}
								>
									{session ? "IN USE" : "FREE"}
								</span>
							</div>
							{session ? (
								<div className="space-y-3">
									<ClientTimer
										openedAt={session.opened_at}
										hourlyRate={Number(session.override_hourly_rate ?? t.hourly_rate)}
										itemTotal={orderItemsTotal}
									/>
									<div className="flex items-center justify-between text-xs text-neutral-400">
										<span>Items total updates in real time.</span>
										<span className="font-mono text-[11px] opacity-70">₱{orderItemsTotal.toFixed(2)}</span>
									</div>
									<div className="pt-1">
										<Link
											className="inline-flex items-center rounded-full bg-neutral-50 px-3 py-1.5 text-xs font-medium text-neutral-900 transition group-hover:bg-emerald-400 group-hover:text-neutral-950"
											href={`/pos/${session.id}`}
										>
											View session
										</Link>
									</div>
								</div>
							) : (
								<>
									{isOnline ? (
										<form action={openTableAction.bind(null, t.id)}>
											<button
												type="submit"
												className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-400"
											>
												Open table
											</button>
										</form>
									) : (
										<button
											type="button"
											onClick={() => {
												void openTableOffline(t, {
													currentTables: tables,
													currentSessions: openSessions,
													currentSessionTotals: sessionTotals,
													setSessions: setOpenSessions,
													setSessionTotals,
													router,
												});
											}}
											className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-400"
										>
											Open table
										</button>
									)}
								</>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}

// Also export as default so it can be imported either way from Server Components.
export default PosHomeClient;

/**
 * Open a new table session purely offline.
 * - Creates local-only ids for the table_session and its order.
 * - Updates local React state so the POS home immediately shows the session.
 * - Writes snapshots to IndexedDB so cold-start offline reloads still work.
 * - Queues a session_opened operation so the server session/order are created
 *   the next time sync runs.
 */
async function openTableOffline(
	table: PoolTable,
	ctx: {
		currentTables: PoolTable[];
		currentSessions: OpenSession[];
		currentSessionTotals: Map<string, number>;
		setSessions: React.Dispatch<React.SetStateAction<OpenSession[]>>;
		setSessionTotals: React.Dispatch<React.SetStateAction<Map<string, number>>>;
		router: ReturnType<typeof useRouter>;
	},
) {
	// If this table already has an open session in local state, just reuse it.
	const existing = ctx.currentSessions.find((s) => s.pool_table_id === table.id);
	if (existing) {
		ctx.router.push(`/pos/${existing.id}`);
		return;
	}

	const localSessionId = createLocalId("session");
	const localOrderId = createLocalId("order");
	const openedAt = new Date().toISOString();

	const newSession: OpenSession = {
		id: localSessionId,
		pool_table_id: table.id,
		opened_at: openedAt,
		override_hourly_rate: null,
	};

	// Update in-memory state so the UI reflects the new session immediately.
	ctx.setSessions((prev) => [...prev, newSession]);
	ctx.setSessionTotals((prev) => {
		const next = new Map(prev);
		next.set(localSessionId, 0);
		return next;
	});

	try {
		// Persist a fresh tables + sessions snapshot that includes this new
		// local-only session so /pos can cold-start offline later.
		const offlineTables: OfflineTable[] = ctx.currentTables.map((t) => ({
			id: t.id,
			name: t.name,
			isActive: t.is_active,
			hourlyRate: t.hourly_rate,
		}));

		const allSessions: OpenSession[] = [...ctx.currentSessions, newSession];
		const offlineSessions: OfflineTableSession[] = allSessions.map((s) => ({
			id: s.id,
			poolTableId: s.pool_table_id,
			openedAt: s.opened_at,
			overrideHourlyRate: s.override_hourly_rate,
			itemsTotal: ctx.currentSessionTotals.get(s.id) ?? 0,
			status: "OPEN",
		}));

		await saveTablesSnapshot({
			tables: offlineTables,
			sessions: offlineSessions,
		});

		// Seed an initial, empty session snapshot so that /pos/[sessionId]
		// can immediately boot the full SessionClient from IndexedDB even
		// on a cold-start while offline.
		await saveSessionSnapshot({
			sessionId: localSessionId,
			tableName: table.name,
			openedAt,
			hourlyRate: table.hourly_rate,
			orderId: localOrderId,
			items: [],
		});

		// Queue the logical "session opened" operation so that, once the
		// device is back online, sync can create the real session + order
		// in Supabase and remember how these local ids map to server ids.
		await queueSessionOpened({
			localSessionId,
			localOrderId,
			poolTableId: table.id,
			openedAt,
			overrideHourlyRate: null,
		});
	} catch {
		// If IndexedDB is unavailable (e.g. private mode), we still keep the
		// in-memory session so the operator can continue using the POS until
		// the page is reloaded.
	}

	// Navigate to the new session using the local id. The session page will
	// attempt to load it from Supabase, and when it does not exist yet it
	// will fall back to the client-side offline bootstrap which reads the
	// snapshot we just saved and runs the full SessionClient from there.
	ctx.router.push(`/pos/${localSessionId}`);
}
