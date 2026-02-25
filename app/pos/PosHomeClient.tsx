'use client';

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ClientTimer } from "./ClientTimer";
import { openTableAction, createWalkInSession, checkInReservation } from "./actions";
import { StartSessionDialog } from "./StartSessionDialog";
import { CustomerSearchDialog } from "./components/CustomerSearchDialog";
import { WalletTopUpDialog } from "./components/WalletTopUpDialog";
import { KitchenDialog } from "./components/KitchenDialog";
import { KitchenBadge } from "./components/KitchenBadge";
import { WalkInDialog } from "./components/WalkInDialog";
import { SettleCreditsDialog } from "./components/SettleCreditsDialog";
import type { CustomerResult } from "./wallet-actions";
import { isBefore, parseISO, addMinutes } from "date-fns";

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

type Reservation = {
	id: string;
	pool_table_id: string;
	start_time: string;
	end_time: string;
	status: string;
	profiles?: { full_name: string };
	customer_name?: string; // Fallback or if joined
};

type PosHomeClientProps = {
	initialTables: PoolTable[];
	initialSessions: OpenSession[];
	initialReservations: Reservation[];
	initialSessionTotals: Array<{ sessionId: string; itemsTotal: number }>;
	initialErrorCode: string | null;
	staffId: string;
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
	initialReservations,
	initialSessionTotals,
	initialErrorCode,
	staffId,
}: PosHomeClientProps) {
	const router = useRouter();
	const [tables, setTables] = useState<PoolTable[]>(initialTables);
	const [openSessions, setOpenSessions] = useState<OpenSession[]>(initialSessions);
	const [reservations, setReservations] = useState<Reservation[]>(initialReservations || []);
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
	const [kitchenOpen, setKitchenOpen] = useState(false);
	const [walkInOpen, setWalkInOpen] = useState(false);

	// Sync state with props when server data changes (e.g. after revalidatePath)
	useEffect(() => {
		setTables(initialTables);
	}, [initialTables]);

	useEffect(() => {
		setOpenSessions(initialSessions);
	}, [initialSessions]);

	useEffect(() => {
		setReservations(initialReservations || []);
	}, [initialReservations]);

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

	// On mount, we just track basic online/offline status for UI feedback.
	// We no longer use offline snapshots or offline session creation.
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

	// Hydration fix: Track "now" in state so it only changes on client, avoiding server/client mismatch.
	const [now, setNow] = useState<Date | null>(null);

	const tableIdToSession = useMemo(() => {
		const map = new Map<string, OpenSession>();
		for (const s of openSessions) {
			if (s.pool_table_id) {
				map.set(s.pool_table_id, s);
			}
		}
		return map;
	}, [openSessions]);



	useEffect(() => {
		if (!now) return;

		// Check for AUTO-START opportunities
		// 1. Table is AVAILABLE (no open session)
		// 2. Reservation is CONFIRMED and Current Time >= Start Time
		// 3. We haven't already processed it (status is still confirmed)

		const checkAutoStart = async () => {
			for (const table of tables) {
				const session = tableIdToSession.get(table.id);
				if (session) continue; // Table busy

				const activeRes = (reservations || []).find(r => r.pool_table_id === table.id &&
					r.status === 'CONFIRMED' &&
					isBefore(parseISO(r.start_time), now) &&
					isBefore(now, parseISO(r.end_time))
				);

				if (activeRes) {
					// Found a candidate!
					// Heuristic:
					// - If late by < 10 mins: Backdate (Strict)
					// - If late by >= 10 mins: Use Now (Delayed)
					const start = parseISO(activeRes.start_time);
					const diffMinutes = (now.getTime() - start.getTime()) / (1000 * 60);
					const useCurrentTime = diffMinutes >= 10;

					console.log(`[AutoStart] Starting reservation ${activeRes.id} for table ${table.name}. Late by ${diffMinutes.toFixed(1)}m. Delayed mode: ${useCurrentTime}`);

					try {
						await checkInReservation(activeRes.id, { useCurrentTime });
						// We don't need to refresh here, server action revalidates path.
					} catch (e) {
						console.error("AutoStart failed", e);
					}
				}
			}
		};

		// Run check every 10 seconds? Or just piggyback on 'now' updates?
		// 'now' updates every minute. 
		// We can also run it immediately on mount/data change.
		void checkAutoStart();

	}, [now, tables, reservations, tableIdToSession]);

	useEffect(() => {
		setNow(new Date());
		const interval = setInterval(() => {
			setNow(new Date());
		}, 1000 * 60); // Update every minute
		return () => clearInterval(interval);
	}, []);

	// Refresh dashboard data on mount/focus to ensure totals are accurate
	useEffect(() => {
		const refresh = () => {
			import("./actions").then(({ getDashboardSnapshot }) => {
				getDashboardSnapshot().then(data => {
					setTables(data.tables as any);
					setOpenSessions(data.sessions as any);

					const map = new Map<string, number>();
					for (const { sessionId, itemsTotal } of data.sessionTotals) {
						map.set(sessionId, itemsTotal);
					}
					setSessionTotals(map);
				});
			});
		};

		// Initial fetch
		refresh();

		// Refresh when window gains focus (e.g. returning from session page)
		window.addEventListener("focus", refresh);
		return () => window.removeEventListener("focus", refresh);
	}, []);

	const [activeTab, setActiveTab] = useState<"tables" | "walkins">("tables");

	return (
		<div className="mx-auto max-w-7xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
				<div>
					<h1 className="text-xl font-semibold text-neutral-50 sm:text-2xl">POS Dashboard</h1>
					<p className="text-sm text-neutral-400">
						Manage pool tables and walk-in sessions with touch-friendly interface.
					</p>
				</div>
				<div className="flex items-center gap-3">
					<KitchenBadge onClick={() => setKitchenOpen(true)} />
					<button
						onClick={() => setCustomerSearchOpen(true)}
						className="flex items-center gap-2 rounded-xl bg-neutral-800 px-4 py-3 font-semibold text-neutral-200 transition hover:bg-neutral-700 active:scale-95"
					>
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
							<path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
						</svg>
						Wallet Top-up
					</button>
					<SettleCreditsDialog
						staffId={staffId}
						onSuccess={(result) => {
							// Refresh the page or show success message
							window.location.reload();
						}}
						onError={(error) => {
							// Show error message
							console.error('Settle credits error:', error);
						}}
					>
						<button className="flex items-center gap-2 rounded-xl bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700 active:scale-95">
							<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
								<path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
							</svg>
							Settle Credits
						</button>
					</SettleCreditsDialog>
				</div>
			</div>
			{errorCode && (
				<div className="rounded-2xl border border-amber-400/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-100">
					{errorCode === "load_failed"
						? "Unable to load live table data. You might be offline or the server is unreachable."
						: "The POS could not reach the server. Some information may be out of date."}
				</div>
			)}

			{/* Tabs */}
			<div className="flex border-b border-white/10">
				<button
					onClick={() => setActiveTab("tables")}
					className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === "tables"
						? "border-b-2 border-emerald-500 text-emerald-400"
						: "text-neutral-400 hover:text-neutral-200"
						}`}
				>
					Tables ({tables.length})
				</button>
				<button
					onClick={() => setActiveTab("walkins")}
					className={`flex-1 px-4 py-3 text-sm font-medium transition ${activeTab === "walkins"
						? "border-b-2 border-emerald-500 text-emerald-400"
						: "text-neutral-400 hover:text-neutral-200"
						}`}
				>
					Walk-ins ({openSessions.filter((s) => !s.pool_table_id).length})
				</button>
			</div>

			{activeTab === "tables" ? (
				<>
					{/* Pool Tables Grid */}
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
						{tables.map((table) => {
					const session = tableIdToSession.get(table.id);
					const orderItemsTotal = session ? sessionTotals.get(session.id) ?? 0 : 0;

					return (
						<div key={table.id}>
							<div
								role="button"
								tabIndex={0}
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
											alert("You are currently offline. Cannot open new sessions.");
										}
									}
								}}
								onKeyDown={(e) => {
									if (e.key === 'Enter' || e.key === ' ') {
										e.currentTarget.click();
									}
								}}
								className={`cursor-pointer relative flex h-full w-full flex-col justify-between rounded-2xl border p-4 text-left shadow-sm transition active:scale-[0.98] ${session
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

									{/* Reservation Logic: Auto-Start & Waiting Indicator */}
									{(() => {
										if (!now) return null;

										// Find confirmed reservation intersecting now
										const activeRes = (reservations || []).find(r => r.pool_table_id === table.id &&
											r.status === 'CONFIRMED' &&
											isBefore(parseISO(r.start_time), now) &&
											isBefore(now, parseISO(r.end_time))
										);

										// Find upcoming reservation (next 2 hours)
										const upcomingRes = (reservations || []).find(r => r.pool_table_id === table.id &&
											r.status === 'CONFIRMED' &&
											!activeRes &&
											isBefore(now, parseISO(r.start_time)) &&
											isBefore(parseISO(r.start_time), addMinutes(now, 120))
										);

										// 1. Auto-Start Logic (Effect-like via immediate invocation check? No, bad pattern in render)
										// We handle Auto-Start in a dedicated useEffect below. Here we just show UI.

										if (activeRes) {
											if (session) {
												// CONFLICT: Table is busy but should be reserved.
												// Is it the SAME person? Unlikely unless we track user IDs.
												// If busy, show "Waiting" state.
												return (
													<div className="mt-2 text-xs font-semibold text-red-400 bg-red-950/30 px-2 py-1 rounded animate-pulse">
														Reservation Waiting ({activeRes.profiles?.full_name})
													</div>
												);
											} else {
												// Table is FREE and Reservation is ACTIVE.
												// The Auto-Start effect should pick this up momentarily.
												// We show "Starting..." or similar.
												return (
													<div className="mt-2 text-xs font-semibold text-emerald-400">
														Starting Reservation...
													</div>
												);
											}
										}

										if (upcomingRes) {
											const start = parseISO(upcomingRes.start_time);
											return (
												<div className="mt-2 text-xs font-semibold text-amber-500 bg-amber-950/30 px-2 py-1 rounded">
													Next: {upcomingRes.profiles?.full_name} @ {start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
												</div>
											);
										}
										return null;
									})()}
								</div>
							</div>
						</div>
					);
				})}
			</div>
				</>
			) : (
				<>
					{/* Walk-ins List - Dense layout */}
					<div className="space-y-3">
						{openSessions.filter((s) => !s.pool_table_id).length > 0 ? (
							openSessions
								.filter((s) => !s.pool_table_id)
								.map((session) => (
									<button
										key={session.id}
										onClick={() => router.push(`/pos/${session.id}`)}
										className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/5 p-4 text-left shadow-sm transition hover:bg-white/10 active:scale-95"
									>
										<div className="flex flex-col items-start">
											<div className="text-sm font-semibold text-neutral-50">
												{session.customer_name ?? "Walk-in"}
											</div>
											<div className="text-xs text-neutral-400">
												Opened {new Date(session.opened_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
											</div>
										</div>
										<div className="flex items-center gap-4">
											<div className="text-right">
												<div className="text-xs text-neutral-400">Items</div>
												<div className="text-sm font-semibold text-neutral-50">
													{sessionTotals.get(session.id) ? `₱${sessionTotals.get(session.id)!.toFixed(2)}` : "₱0.00"}
												</div>
											</div>
											<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 text-neutral-400">
												<path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
											</svg>
										</div>
									</button>
								))
						) : (
							<div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center">
								<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="mx-auto h-12 w-12 text-neutral-600">
									<path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
								</svg>
								<h3 className="mt-4 text-sm font-semibold text-neutral-300">No active walk-in sessions</h3>
								<p className="mt-1 text-xs text-neutral-500">Create a walk-in session to get started.</p>
							</div>
						)}
					</div>
				</>
			)}

			{/* Walk-in / Quick Order Button */}
			<div className="fixed bottom-6 right-6 z-10">
				<button
					type="button"
					onClick={() => {
						if (isOnline) {
							setWalkInOpen(true);
						} else {
							alert("You are currently offline. Cannot create walk-in sessions.");
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
				onSelectCustomer={(res) => {
					if (res.fullCustomer) {
						setSelectedCustomer(res.fullCustomer);
						setCustomerSearchOpen(false);
						setTopUpOpen(true);
					} else if (res.name) {
						// Handle Guest/New Customer
						setSelectedCustomer({
							id: "guest",
							name: res.name,
							full_name: res.name,
							wallet: { id: "guest", balance: 0 } // Dummy wallet for guest
						} as any);
						setCustomerSearchOpen(false);
						setTopUpOpen(true);
					}
				}}
			/>

			<WalletTopUpDialog
				isOpen={topUpOpen}
				onClose={() => setTopUpOpen(false)}
				customer={selectedCustomer}
			/>

			<KitchenDialog
				isOpen={kitchenOpen}
				onClose={() => setKitchenOpen(false)}
			/>

			<WalkInDialog
				isOpen={walkInOpen}
				onClose={() => setWalkInOpen(false)}
				onConfirm={(name, profileId) => {
					createWalkInSession(name, profileId);
					setWalkInOpen(false);
				}}
			/>
		</div>
	);
}

// Also export as default so it can be imported either way from Server Components.
export default PosHomeClient;
