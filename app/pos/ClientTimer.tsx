'use client'

import { useEffect, useMemo, useState } from "react";

export function ClientTimer(props: {
	openedAt: string;
	hourlyRate: number;
	itemTotal: number;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
	sessionType?: "OPEN" | "FIXED";
	targetDurationMinutes?: number;
	isMoneyGame?: boolean;
	betAmount?: number;
	isPrepaid?: boolean;
}) {
	const {
		openedAt,
		hourlyRate,
		itemTotal,
		pausedAt,
		accumulatedPausedTime,
		sessionType = "OPEN",
		targetDurationMinutes,
		isMoneyGame,
		betAmount,
		isPrepaid,
	} = props;

	return (
		<div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-neutral-200 shadow-inner shadow-black/60">
			<TimerContent
				openedAt={openedAt}
				hourlyRate={hourlyRate}
				itemTotal={itemTotal}
				pausedAt={pausedAt}
				accumulatedPausedTime={accumulatedPausedTime}
				sessionType={sessionType}
				targetDurationMinutes={targetDurationMinutes}
				isMoneyGame={isMoneyGame}
				betAmount={betAmount}
				isPrepaid={isPrepaid}
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
	sessionType,
	targetDurationMinutes,
	isMoneyGame,
	betAmount,
	isPrepaid,
}: {
	openedAt: string;
	hourlyRate: number;
	itemTotal: number;
	pausedAt?: string | null;
	accumulatedPausedTime?: number;
	sessionType?: "OPEN" | "FIXED";
	targetDurationMinutes?: number;
	isMoneyGame?: boolean;
	betAmount?: number;
	isPrepaid?: boolean;
}) {
	// Hydration fix: Initialize with null so we match server render initially
	const [now, setNow] = useState<number | null>(null);
	const [isMounted, setIsMounted] = useState(false);

	useEffect(() => {
		setIsMounted(true);
	}, []);

	useEffect(() => {
		setNow(Date.now()); // Set initial client time
	}, []);

	useEffect(() => {
		if (pausedAt) {
			return;
		}
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, [pausedAt]);

	const elapsedMs = useMemo(() => {
		if (!now) return 0; // Prevent mismatch during hydration
		const start = new Date(openedAt).getTime();
		const accumulated = (accumulatedPausedTime || 0) * 1000;
		if (pausedAt) {
			const pauseStart = new Date(pausedAt).getTime();
			return Math.max(0, pauseStart - start - accumulated);
		}
		return Math.max(0, now - start - accumulated);
	}, [now, openedAt, pausedAt, accumulatedPausedTime]);

	const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
	let tableFee = 0;

	// Calculate fees
	if (sessionType === "FIXED" && targetDurationMinutes) {
		// Fixed Time Logic
		const baseFee = (targetDurationMinutes / 60) * hourlyRate;
		const excessMinutes = Math.max(0, elapsedMinutes - targetDurationMinutes);
		const excessFee = excessMinutes * (hourlyRate / 60);

		if (isPrepaid) {
			// If prepaid, we only charge for excess time.
			tableFee = excessFee;
		} else {
			tableFee = baseFee + excessFee;
		}
	} else {
		// Open Time Logic (Default)
		// "exceeds 5 mins... add every 30 mins"
		if (elapsedMinutes > 5) {
			const blocks = Math.ceil(elapsedMinutes / 30);
			tableFee = blocks * 0.5 * hourlyRate;
		}
	}

	// Money Game Logic: Max of calculated fee or 10% of bet
	if (isMoneyGame && betAmount) {
		const minimumFee = betAmount * 0.10;
		tableFee = Math.max(tableFee, minimumFee);
	}

	tableFee = Number(tableFee.toFixed(2));
	const estimatedTotal = Number((tableFee + itemTotal).toFixed(2));

	const totalSeconds = Math.floor(elapsedMs / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;

	// Use existence of 'now' as the hydration check
	if (now === null) {
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

	const isOvertime = sessionType === "FIXED" && targetDurationMinutes && elapsedMinutes > targetDurationMinutes;

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
					{isMoneyGame && (
						<span className="flex h-3 w-3 items-center justify-center rounded bg-emerald-500/20 text-[8px] font-bold text-emerald-500 uppercase">
							$
						</span>
					)}
					{isPrepaid && (
						<span className="rounded bg-emerald-600/30 px-1 py-0.5 text-[8px] font-bold text-emerald-400 uppercase tracking-widest">
							Prepaid
						</span>
					)}
				</div>
				<div className={`font-mono text-lg ${pausedAt ? "text-amber-400" : isOvertime ? "text-red-400" : "text-neutral-50"}`}>
					{hours.toString().padStart(2, "0")}:{minutes.toString().padStart(2, "0")}:
					{seconds.toString().padStart(2, "0")}
				</div>
				{sessionType === "FIXED" && targetDurationMinutes && (
					<div className="text-[10px] text-neutral-500">
						Target: {Math.floor(targetDurationMinutes / 60)}h {targetDurationMinutes % 60 > 0 ? `${targetDurationMinutes % 60}m` : ''}
						{isOvertime && <span className="text-red-400 ml-1">Overtime</span>}
					</div>
				)}
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




