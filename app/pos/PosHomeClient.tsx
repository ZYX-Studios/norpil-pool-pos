'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientTimer } from "./ClientTimer";
import { openTableAction, createWalkInSession } from "./actions";
import { StartSessionDialog } from "./StartSessionDialog";
import { CustomerSearchDialog } from "./components/CustomerSearchDialog";
import { WalletTopUpDialog } from "./components/WalletTopUpDialog";
import type { CustomerResult } from "./wallet-actions";
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
	pool_table_id: string | null;
	opened_at: string;
	override_hourly_rate: number | null;
	customer_name?: string | null;
	paused_at?: string | null;
	accumulated_paused_time?: number;
	session_type?: "OPEN" | "FIXED";
	target_duration_minutes?: number | null;
	is_money_game?: boolean;
	bet_amount?: number | null;
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

	const [startSessionDialog, setStartSessionDialog] = useState<{
		isOpen: boolean;
		tableId: string | null;
		tableName: string;
		hourlyRate: number;
	}>({
		isOpen: false,
		tableId: null,
		tableName: "",
		hourlyRate: 0,
	});

	const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
	const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
	const [topUpOpen, setTopUpOpen] = useState(false);

	// Sync state with props when server data changes (e.g. after revalidatePath)
	useEffect(() => {
		setTables(initialTables);
	}, [initialTables]);

	useEffect(() => {
		setOpenSessions(initialSessions);
	}, [initialSessions]);

	useEffect(() => {
		const map = new Map<string, number>();
		for (const { sessionId, itemsTotal } of initialSessionTotals) {
			map.set(sessionId, itemsTotal);
		}
		setSessionTotals(map);
	}, [initialSessionTotals]);

	useEffect(() => {
		setErrorCode(initialErrorCode);
	}, [initialErrorCode]);

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
						pausedAt: s.paused_at,
						accumulatedPausedTime: s.accumulated_paused_time,
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
							customer_name: s.customerName,
							paused_at: s.pausedAt,
							accumulated_paused_time: s.accumulatedPausedTime,
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
			if (s.pool_table_id) {
				map.set(s.pool_table_id, s);
			}
		}
		return map;
	}, [openSessions]);

	return (
		<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">Tables</h1>
					<p className="text-sm text-neutral-400">
						Open and manage live pool sessions with large, touch-friendly tiles.
					</p>
				</div>
				<div>
					<button
						onClick={() => setCustomerSearchOpen(true)}
						className="flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-neutral-700 active:scale-95"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
							<path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
						</svg>
						Customers
					</button>
				</div>
			</div>
			{errorCode && (
				<div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
					{errorCode === "load_failed"
						? "Unable to load live table data. You might be offline or the server is unreachable."
						: errorCode === "cached_snapshot"
							? "Showing the last known table data from this device. Some information may be out of date."
							: "The POS could not reach the server. Some actions may be temporarily unavailable."}
				</div>
			)}
			{/* 
			{/*
				Grid tuned for tablets:
				- 1 column on phones.
				- 2 columns on tablets (gives big tap targets).
				- 3 columns only on larger desktop screens.
			*/}
			{/* Active Walk-in Sessions */}
			{openSessions.filter((s) => !s.pool_table_id).length > 0 && (
				<div className="mb-8">
					<h2 className="mb-4 text-lg font-semibold text-neutral-200">Active Walk-ins</h2>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{openSessions
							.filter((s) => !s.pool_table_id)
							.map((session) => (
								<button
									key={session.id}
									onClick={() => router.push(`/pos/${session.id}`)}
									className="flex flex-col items-start justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition hover:bg-white/10 active:scale-95"
								>
									<div className="mb-2">
										<div className="text-xs font-medium uppercase tracking-wider text-neutral-400">
											Customer
										</div>
										<div className="font-semibold text-neutral-50">
											{session.customer_name ?? "Walk-in"}
										</div>
									</div>
									<div className="text-xs text-neutral-400">
										Opened {new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
									</div>
								</button>
							))}
					</div>
				</div>
			)}

			{/* Pool Tables Grid */}
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
				{tables.map((table) => {
					const session = tableIdToSession.get(table.id);
					const orderItemsTotal = session ? sessionTotals.get(session.id) ?? 0 : 0;

					return (
						<div key={table.id}>
							<button
								onClick={() => {
									if (session) {
										router.push(`/pos/${session.id}`);
									} else {
										if (isOnline) {
											setStartSessionDialog({
												isOpen: true,
												tableId: table.id,
												tableName: table.name,
												hourlyRate: table.hourly_rate,
											});
										} else {
											void openTableOffline(table, {
												currentTables: tables,
												currentSessions: openSessions,
												currentSessionTotals: sessionTotals,
												setSessions: setOpenSessions,
												setSessionTotals,
												router,
											});
										}
									}
								}}
								className={`relative flex h-full w-full flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.98] ${session
									? "border-emerald-500/50 bg-emerald-500/10 hover:bg-emerald-500/20"
									: "border-white/10 bg-white/5 hover:bg-white/10"
									}`}
							>
								<div className="flex w-full items-start justify-between">
									<div className="flex flex-col">
										<span
											className={`text-sm font-bold uppercase tracking-wider ${session ? "text-emerald-400" : "text-neutral-400"
												}`}
										>
											{table.name}
										</span>
										{session && (
											<span className="mt-1 text-xs font-medium text-emerald-300/80">
												Occupied
											</span>
										)}
									</div>
									<div
										className={`flex h-8 w-8 items-center justify-center rounded-full ${session ? "bg-emerald-500 text-white" : "bg-white/10 text-neutral-400"
											}`}
									>
										{session ? (
											<svg
												xmlns="http://www.w3.org/2000/svg"
												viewBox="0 0 20 20"
												fill="currentColor"
												className="h-5 w-5"
											>
												<path d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" />
											</svg>
										) : (
											<svg
												xmlns="http://www.w3.org/2000/svg"
												fill="none"
												viewBox="0 0 24 24"
												strokeWidth={1.5}
												stroke="currentColor"
												className="h-5 w-5"
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M12 4.5v15m7.5-7.5h-15"
												/>
											</svg>
										)}
									</div>
								</div>

								<div className="mt-4">
									{session ? (
										<div className="flex flex-col gap-1">
											<ClientTimer
												openedAt={session.opened_at}
												hourlyRate={Number(session.override_hourly_rate ?? table.hourly_rate)}
												itemTotal={orderItemsTotal}
												pausedAt={session.paused_at}
												accumulatedPausedTime={session.accumulated_paused_time}
												sessionType={session.session_type}
												targetDurationMinutes={session.target_duration_minutes ?? undefined}
												isMoneyGame={session.is_money_game}
												betAmount={session.bet_amount ?? undefined}
											/>
										</div>
									) : (
										<div className="text-sm font-medium text-neutral-500">Available</div>
									)}
								</div>
							</button>
						</div>
					);
				})}
			</div>

			{/* Walk-in / Quick Order Button */}
			<div className="fixed bottom-6 right-6 z-10">
				<button
					type="button"
					onClick={() => {
						const name = window.prompt("Enter customer name for walk-in order:");
						if (name) {
							if (isOnline) {
								createWalkInSession(name);
							} else {
								void createWalkInSessionOffline(name, {
									currentTables: tables,
									currentSessions: openSessions,
									currentSessionTotals: sessionTotals,
									setSessions: setOpenSessions,
									setSessionTotals,
									router,
								});
							}
						}
					}}
					className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/40 transition hover:bg-emerald-400 active:scale-95 sm:h-16 sm:w-auto sm:px-6"
				>
					<span className="text-2xl sm:mr-2 sm:text-xl">+</span>
					<span className="hidden text-base font-semibold sm:inline">Walk-in</span>
				</button>
			</div>

			<StartSessionDialog
				isOpen={startSessionDialog.isOpen}
				onClose={() => setStartSessionDialog(prev => ({ ...prev, isOpen: false }))}
				tableName={startSessionDialog.tableName}
				hourlyRate={startSessionDialog.hourlyRate}
				onConfirm={(data) => {
					if (startSessionDialog.tableId) {
						openTableAction({
							poolTableId: startSessionDialog.tableId,
							...data,
						});
						setStartSessionDialog(prev => ({ ...prev, isOpen: false }));
					}
				}}
			/>

			<CustomerSearchDialog
				isOpen={customerSearchOpen}
				onClose={() => setCustomerSearchOpen(false)}
				onSelectCustomer={(customer) => {
					setSelectedCustomer(customer);
					setCustomerSearchOpen(false);
					setTopUpOpen(true);
				}}
			/>

			<WalletTopUpDialog
				isOpen={topUpOpen}
				onClose={() => setTopUpOpen(false)}
				customer={selectedCustomer}
			/>
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
			customerName: s.customer_name,
			pausedAt: s.paused_at,
			accumulatedPausedTime: s.accumulated_paused_time,
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

/**
 * Open a new walk-in session purely offline.
 */
async function createWalkInSessionOffline(
	customerName: string,
	ctx: {
		currentTables: PoolTable[];
		currentSessions: OpenSession[];
		currentSessionTotals: Map<string, number>;
		setSessions: React.Dispatch<React.SetStateAction<OpenSession[]>>;
		setSessionTotals: React.Dispatch<React.SetStateAction<Map<string, number>>>;
		router: ReturnType<typeof useRouter>;
	},
) {
	const localSessionId = createLocalId("session");
	const localOrderId = createLocalId("order");
	const openedAt = new Date().toISOString();

	const newSession: OpenSession = {
		id: localSessionId,
		pool_table_id: null,
		opened_at: openedAt,
		override_hourly_rate: null,
		customer_name: customerName,
	};

	// Update in-memory state
	ctx.setSessions((prev) => [...prev, newSession]);
	ctx.setSessionTotals((prev) => {
		const next = new Map(prev);
		next.set(localSessionId, 0);
		return next;
	});

	try {
		// Persist snapshot
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
			customerName: s.customer_name,
			pausedAt: s.paused_at,
			accumulatedPausedTime: s.accumulated_paused_time,
		}));

		await saveTablesSnapshot({
			tables: offlineTables,
			sessions: offlineSessions,
		});

		// Seed session snapshot
		await saveSessionSnapshot({
			sessionId: localSessionId,
			tableName: customerName, // Use customer name as table name for walk-ins
			openedAt,
			hourlyRate: 0, // Walk-ins usually don't have hourly rate unless assigned later? Or maybe 0.
			orderId: localOrderId,
			items: [],
			customerName,
		});

		// Queue sync
		await queueSessionOpened({
			localSessionId,
			localOrderId,
			poolTableId: null,
			openedAt,
			overrideHourlyRate: null,
			customerName,
		});
	} catch (err) {
		console.error("createWalkInSessionOffline failed", err);
	}

	ctx.router.push(`/pos/${localSessionId}`);
}
