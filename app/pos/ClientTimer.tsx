'use client'

import { useEffect, useMemo, useState } from "react";

export function ClientTimer(props: { openedAt: string; hourlyRate: number; itemTotal: number }) {
	const { openedAt, hourlyRate, itemTotal } = props;
	return (
		<div className="rounded-2xl border border-white/10 bg-black/40 p-3 text-xs text-neutral-200 shadow-inner shadow-black/60">
			<TimerContent openedAt={openedAt} hourlyRate={hourlyRate} itemTotal={itemTotal} />
		</div>
	);
}

function TimerContent({ openedAt, hourlyRate, itemTotal }: { openedAt: string; hourlyRate: number; itemTotal: number }) {
	const [now, setNow] = useState(() => Date.now());
	useEffect(() => {
		const id = setInterval(() => setNow(Date.now()), 1000);
		return () => clearInterval(id);
	}, []);

	const elapsedMs = useMemo(() => now - new Date(openedAt).getTime(), [now, openedAt]);
	const elapsedMinutes = Math.max(0, Math.floor(elapsedMs / (1000 * 60)));
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

	return (
		<div className="flex items-center justify-between gap-4">
			<div>
				<div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">Elapsed</div>
				<div className="font-mono text-lg text-neutral-50">
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
	return new Intl.NumberFormat(undefined, { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" }).format(n);
}




