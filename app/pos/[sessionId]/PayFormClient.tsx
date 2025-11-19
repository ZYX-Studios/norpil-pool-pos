'use client';

import { useEffect, useMemo, useState } from "react";
import { payOrderFormAction } from "./actions";

type PayFormClientProps = {
	sessionId: string;
	suggestedAmount: number;
	errorCode?: string;
};

// Simple client-side payment form with a tablet-friendly keypad.
// The keypad appears in a modal when the amount field is focused.
// This keeps typing easy on touch devices while still allowing manual input.
export function PayFormClient({ sessionId, suggestedAmount, errorCode }: PayFormClientProps) {
	const [amount, setAmount] = useState(() => Number(suggestedAmount).toFixed(2));
	const [open, setOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [hasTypedOnKeypad, setHasTypedOnKeypad] = useState(false);
	const [method, setMethod] = useState<"CASH" | "GCASH" | "CARD" | "OTHER">("CASH");
	const [validationError, setValidationError] = useState<string | null>(null);

	function handleKeyPress(key: string) {
		// Append digits or dot, keep the string simple and readable.
		if (key === "C") {
			setAmount("");
			setHasTypedOnKeypad(false);
			return;
		}
		if (key === "⌫") {
			setAmount((prev) => prev.slice(0, -1));
			return;
		}
		if (key === ".") {
			setAmount((prev) => (prev.includes(".") ? prev : (prev || "0") + "."));
			return;
		}
		// For numeric keys we either start fresh or append.
		// First digit press should replace the default "0.00" feel.
		setAmount((prev) => {
			const cleaned = prev.trim();
			if (!hasTypedOnKeypad || cleaned === "" || cleaned === "0" || cleaned === "0.00") {
				setHasTypedOnKeypad(true);
				// Starting value: single key, e.g. "5" (shown as ₱5.00 via formatter).
				return key === "00" ? "0" : key;
			}
			return cleaned + key;
		});
	}

	// Allow physical keyboard keys to drive the keypad when it is open.
	useEffect(() => {
		if (!open) return;

		function onKeyDown(e: KeyboardEvent) {
			const { key } = e;
			if (key >= "0" && key <= "9") {
				e.preventDefault();
				handleKeyPress(key);
				return;
			}
			if (key === ".") {
				e.preventDefault();
				handleKeyPress(".");
				return;
			}
			if (key === "Backspace") {
				e.preventDefault();
				handleKeyPress("⌫");
				return;
			}
			if (key === "Delete") {
				e.preventDefault();
				handleKeyPress("C");
				return;
			}
			if (key === "Escape") {
				e.preventDefault();
				setOpen(false);
			}
		}

		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open, handleKeyPress]);

	// Parse the current amount string into a number so we can show change.
	const parsedAmount = useMemo(() => {
		const cleaned = (amount || "").replace(/[^0-9.]/g, "");
		const value = parseFloat(cleaned);
		return Number.isFinite(value) ? value : 0;
	}, [amount]);

	const change = Math.max(0, parsedAmount - suggestedAmount);

	return (
		<form
			// Use the server action so we keep the existing payment logic.
			action={payOrderFormAction}
			className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-neutral-50 shadow-sm shadow-black/50 backdrop-blur"
		>
			<input type="hidden" name="sessionId" value={sessionId} />
			<h2 className="mb-2 text-sm font-semibold text-neutral-50">Payment</h2>
			<p className="mb-3 text-xs text-neutral-200">Confirm method and amount to close this table.</p>
			{(errorCode === "amount" || validationError) && (
				<div className="mb-3 rounded border border-red-500/60 bg-red-500/10 px-2 py-1 text-[11px] text-red-200">
					{validationError || "Amount must be greater than zero."}
				</div>
			)}
			<div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs text-neutral-100">Method</label>
					<select
						name="method"
						className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2 text-xs text-neutral-50"
						value={method}
						onChange={(e) => setMethod(e.target.value as typeof method)}
					>
						<option value="CASH">Cash</option>
						<option value="GCASH">GCash</option>
						<option value="CARD">Card</option>
						<option value="OTHER">Other</option>
					</select>
				</div>
				<div>
					<label className="mb-1 block text-xs text-neutral-100">Amount</label>
					<div className="relative">
						<input
							// This is the tendered cash amount we send to the server.
							// The server computes the final bill and uses that as revenue.
							name="tenderedAmount"
							// Use text so we can freely control the value from the keypad.
							type="text"
							inputMode="decimal"
							value={amount}
							onChange={(e) => setAmount(e.target.value)}
							onFocus={() => {
								// Open keypad and mark that the next digit can replace the default.
								setOpen(true);
								setHasTypedOnKeypad(false);
							}}
							className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2 text-xs text-neutral-50 pr-16"
							required
						/>
						<button
							type="button"
							onClick={() => {
								setOpen(true);
								setHasTypedOnKeypad(false);
							}}
							className="absolute inset-y-0 right-1 my-1 rounded-full bg-emerald-500/20 px-3 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/30"
						>
							Keypad
						</button>
					</div>
				</div>
			</div>
			<button
				type="button"
				onClick={() => {
					// Do a simple client-side check: amount should cover the bill total.
					if (parsedAmount + 0.0001 < suggestedAmount) {
						setValidationError("Amount cannot be less than the bill total.");
						return;
					}
					setValidationError(null);
					// Close keypad (if open) and ask for final confirmation.
					setOpen(false);
					setConfirmOpen(true);
				}}
				className="w-full rounded bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:bg-neutral-800"
			>
				Pay &amp; Close
			</button>
			<p className="mt-2 text-[11px] text-neutral-200">
				On pay, table time is finalized and stored on the order.
			</p>
			{/* 
				Show a simple change helper so staff can see how much to return.
				This uses the current amount minus the suggested total from the order.
			*/}
			<div className="mt-2 text-[11px] text-neutral-200">
				<div className="flex justify-between">
					<span>Bill total</span>
					<span className="font-mono">{formatCurrency(suggestedAmount)}</span>
				</div>
				<div className="flex justify-between">
					<span>Cash entered</span>
					<span className="font-mono">{formatCurrency(parsedAmount)}</span>
				</div>
				<div className="mt-1 flex justify-between font-semibold text-emerald-200">
					<span>Change</span>
					<span className="font-mono">{formatCurrency(change)}</span>
				</div>
			</div>

			{/* 
				Simple full-screen keypad modal.
				Appears on tablets when focusing the amount field or tapping the keypad button.
			*/}
			{open && (
				/* 
					Use a bottom sheet style popup so it clearly feels like a keypad overlay.
					This keeps the rest of the screen visible but dimmed.
				*/
				<div className="fixed inset-0 z-50 flex items-end bg-black/70 px-4 pb-6">
					<div className="w-full max-w-sm mx-auto rounded-2xl border border-white/10 bg-neutral-900 p-4 text-center shadow-lg shadow-black/70">
						<div className="mb-2 text-xs text-neutral-400">Enter amount</div>
						<div className="mb-4 rounded border border-emerald-400/40 bg-black/60 px-3 py-2 font-mono text-lg text-emerald-200">
							{formatCurrency(parsedAmount)}
						</div>
						<div className="grid grid-cols-3 gap-2 text-sm">
							{["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "00"].map((key) => (
								<button
									key={key}
									type="button"
									onClick={() => handleKeyPress(key)}
									className="rounded-lg bg-neutral-800 px-3 py-2 font-medium text-neutral-50 hover:bg-neutral-700"
								>
									{key}
								</button>
							))}
						</div>
						<div className="mt-3 grid grid-cols-3 gap-2 text-xs">
							<button
								type="button"
								onClick={() => handleKeyPress("C")}
								className="rounded-lg bg-red-600/80 px-3 py-2 font-medium text-white hover:bg-red-500"
							>
								Clear
							</button>
							<button
								type="button"
								onClick={() => handleKeyPress("⌫")}
								className="rounded-lg bg-neutral-800 px-3 py-2 font-medium text-neutral-50 hover:bg-neutral-700"
							>
								⌫
							</button>
							<button
								type="button"
								onClick={() => setOpen(false)}
								className="rounded-lg bg-emerald-500 px-3 py-2 font-medium text-neutral-900 hover:bg-emerald-400"
							>
								Done
							</button>
						</div>
					</div>
				</div>
			)}

			{/* 
				Confirmation modal: avoids accidental payments.
				Shows method, bill, cash, and change before we submit to the server.
			*/}
			{confirmOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
					<div className="w-full max-w-sm rounded-2xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-50 shadow-lg shadow-black/70">
						<h3 className="mb-2 text-base font-semibold">Confirm payment</h3>
						<p className="mb-3 text-xs text-neutral-300">
							Please confirm the payment details before closing this table.
						</p>
						<div className="space-y-1 text-xs">
							<div className="flex justify-between">
								<span>Method</span>
								<span className="font-medium">{method}</span>
							</div>
							<div className="flex justify-between">
								<span>Bill total</span>
								<span className="font-mono">{formatCurrency(suggestedAmount)}</span>
							</div>
							<div className="flex justify-between">
								<span>Cash entered</span>
								<span className="font-mono">{formatCurrency(parsedAmount)}</span>
							</div>
							<div className="flex justify-between font-semibold text-emerald-200">
								<span>Change</span>
								<span className="font-mono">{formatCurrency(change)}</span>
							</div>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<button
								type="button"
								onClick={() => setConfirmOpen(false)}
								className="rounded-full border border-white/20 px-3 py-1 text-xs hover:bg-white/10"
							>
								Cancel
							</button>
							<button
								type="submit"
								className="rounded-full bg-emerald-500 px-3 py-1 text-xs font-medium text-neutral-900 hover:bg-emerald-400"
							>
								Confirm &amp; pay
							</button>
						</div>
					</div>
				</div>
			)}
		</form>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}


