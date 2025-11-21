'use client';

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClientTimer } from "./ClientTimer";
import { openTableAction } from "./actions";
import {
	getTablesSnapshot,
	saveTablesSnapshot,
	type OfflineTable,
	type OfflineTableSession,
} from "@/lib/offline/client";

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
 */
export function PosHomeClient({
	initialTables,
	initialSessions,
	initialSessionTotals,
	initialErrorCode,
}: PosHomeClientProps) {
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
	const [isOnline, setIsOnline] = useState(
		typeof navigator !== "undefined" ? navigator.onLine : true,
	);

	// On mount, decide whether to use server data or fall back to cached snapshot.
	// Track basic online/offline status so we can disable actions that must hit the server.
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
							className={`group rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur transition hover:border-emerald-400/60 hover:bg-white/10 ${
								session ? "ring-1 ring-emerald-500/40" : ""
							}`}
						>
							<div className="mb-3 flex items-center justify-between">
								<div className="text-sm font-medium text-neutral-50 sm:text-base">{t.name}</div>
								<span
									className={`rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide ${
										session ? "bg-emerald-500/20 text-emerald-300" : "bg-neutral-700/60 text-neutral-200"
									}`}
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
								<form action={openTableAction.bind(null, t.id)}>
									<button
										type="submit"
										disabled={!isOnline}
										className="inline-flex items-center rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-300"
									>
										{isOnline ? "Open table" : "Open table (online only)"}
									</button>
								</form>
							)}
						</div>
					);
				})}
			</div>
		</div>
	);
}


