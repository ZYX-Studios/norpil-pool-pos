'use client'

import { useEffect, useMemo, useState } from "react";

export function ClientTimer(props: {
	openedAt: string;
	hourlyRate: number;
	itemTotal: number;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
}) {
	const { openedAt, hourlyRate, itemTotal, pausedAt, accumulatedPausedTime } = props;
	return (
		<div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-neutral-200 shadow-inner shadow-black/60">
			<TimerContent
				openedAt={openedAt}
				hourlyRate={hourlyRate}
				itemTotal={itemTotal}
				pausedAt={pausedAt}
				accumulatedPausedTime={accumulatedPausedTime}
			/>
		</div>
	);
}

function TimerContent({
	openedAt,
	hourlyRate,
	itemTotal,
	pausedAt,
	accumulatedPausedTime = 0,
}: {
	openedAt: string;
	hourlyRate: number;
	itemTotal: number;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
}) {
	const [now, setNow] = useState(() => Date.now());
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		if (pausedAt) {
			return;
		}
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [pausedAt]);

	const elapsedMs = useMemo(() => {
		const start = new Date(openedAt).getTime();
		const accumulated = (accumulatedPausedTime || 0) * 1000;
		if (pausedAt) {
			const pauseStart = new Date(pausedAt).getTime();
			return Math.max(0, pauseStart - start - accumulated);
		}
		// During server render or initial client render, use a stable time if possible,
		// but since we suppress hydration warning on the time display, we just need
		// to be consistent. However, 'now' changes.
		// To be safe, we can just use 'now' but rely on suppressHydrationWarning
		// which is already there. But 'estimatedTotal' also depends on it.
		return Math.max(0, now - start - accumulated);
	}, [now, openedAt, pausedAt, accumulatedPausedTime]);

	const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
	const graceMinutes = 5;
	let billedHours = 0;
	if (elapsedMinutes > graceMinutes) {
		const extra = elapsedMinutes - graceMinutes;
		billedHours = Math.ceil(extra / 60);
	}
	const tableFee = Number((billedHours * hourlyRate).toFixed(2));
	const estimatedTotal = Number((tableFee + itemTotal).toFixed(2));

	const totalSeconds = Math.floor(elapsedMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	if (!isMounted) {
		return (
			<div className="flex items-center justify-between gap-4">
				<div>
					<div className="flex items-center gap-2">
						<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
							{pausedAt ? "Paused" : "Elapsed"}
						</div>
					</div>
					<div className="font-mono text-lg text-neutral-50">--:--:--</div>
				</div>
				<div className="text-right">
					<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Est. total</div>
					<div className="font-semibold text-emerald-300">--</div>
					<div className="text-[10px] text-neutral-500">Incl. items, live</div>
				</div>
			</div>
		);
	}

	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<div className="flex items-center gap-2">
					<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
						{pausedAt ? "Paused" : "Elapsed"}
					</div>
					{pausedAt && (
						<span className="flex h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />
					)}
				</div>
				<div className={`font-mono text-lg ${pausedAt ? "text-amber-400" : "text-neutral-50"}`}>
					{hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:
					{seconds.toString().padStart(2, "0")}
				</div>
			</div>
			<div className="text-right">
				<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Est. total</div>
				<div className="font-semibold text-emerald-300">{formatCurrency(estimatedTotal)}</div>
				<div className="text-[10px] text-neutral-500">Incl. items, live</div>
			</div>
		</div>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" }).format(n);
}




