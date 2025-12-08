'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { payOrderFormAction } from "./actions";
import { processPaymentCode } from "../wallet-actions";
import { queueSaleCreated } from "@/lib/offline/client";

type PayFormClientProps = {
	sessionId: string;
	suggestedAmount: number;
	errorCode?: string;
	// Optional callback used by the session client to mark that an offline
	// payment has been queued. This lets the cart freeze further edits locally.
	onOfflineQueued?: () => void;
};

// Simple client-side payment form with a tablet-friendly keypad.
// The keypad appears in a modal when the amount field is focused.
// This keeps typing easy on touch devices while still allowing manual input.
export function PayFormClient({
	sessionId,
	suggestedAmount,
	errorCode,
	onOfflineQueued,
}: PayFormClientProps) {
	const formRef = useRef<HTMLFormElement | null>(null);
	const [amount, setAmount] = useState(() => Number(suggestedAmount).toFixed(2));
	const [open, setOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [hasTypedOnKeypad, setHasTypedOnKeypad] = useState(false);
	const [method, setMethod] = useState<"CASH" | "GCASH" | "CARD" | "WALLET" | "OTHER">("CASH");
	const [walletCode, setWalletCode] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isOnline, setIsOnline] = useState(true);
	const [offlineInfo, setOfflineInfo] = useState<string | null>(null);
	// We only render portal-based overlays once the component is mounted in the browser.
	const [isMounted, setIsMounted] = useState(false);

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

	// Track basic connectivity so we can prevent submitting while offline.
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

	// Mark that we are now safely running in the browser so portals can attach to document.body.
	useEffect(() => {
		setIsMounted(true);
	}, []);

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
			ref={formRef}
			className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-neutral-50 shadow-sm shadow-black/50 backdrop-blur"
		>
			<input type="hidden" name="sessionId" value={sessionId} />
			{/* Keep the selected method in sync with the server action via a hidden field. */}
			<input type="hidden" name="method" value={method} />
			<h2 className="mb-2 text-sm font-semibold text-neutral-50">Payment</h2>
			<p className="mb-3 text-xs sm:text-sm text-neutral-200">
				Choose method and confirm the cash received to close this table.
			</p>
			{offlineInfo && (
				<div className="mb-3 rounded border border-amber-400/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
					{offlineInfo}
				</div>
			)}
			{(errorCode === "amount" || validationError) && (
				<div className="mb-3 rounded border border-red-500/60 bg-red-500/10 px-3 py-2 text-xs text-red-200">
					{validationError || "Amount must be greater than zero."}
				</div>
			)}
			<div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
				<div>
					<label className="mb-1 block text-xs text-neutral-100">Method</label>
					{/* Large, touch-friendly method pills instead of a small select. */}
					<div className="flex flex-wrap gap-2 text-xs sm:text-sm">
						{[
							{ id: "CASH" as const, label: "Cash" },
							{ id: "GCASH" as const, label: "GCash" },
							{ id: "CARD" as const, label: "Card" },
							{ id: "WALLET" as const, label: "Wallet" },
							{ id: "OTHER" as const, label: "Other" },
						].map((m) => {
							const isActive = method === m.id;
							return (
								<button
									key={m.id}
									type="button"
									onClick={() => setMethod(m.id)}
									className={`rounded-full border px-3 py-1.5 font-medium transition ${isActive
										? "border-white/80 bg-white text-neutral-900"
										: "border-emerald-400/40 bg-black/40 text-neutral-50 hover:border-emerald-300 hover:text-white"
										}`}
								>
									{m.label}
								</button>
							);
						})}
					</div>
				</div>

				<div>
					{method === "WALLET" ? (
						<>
							<label className="mb-1 block text-xs text-neutral-100">Payment Code</label>
							<input
								type="text"
								placeholder="Enter 6-digit code"
								className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2.5 text-sm text-neutral-50 tracking-widest font-mono"
								value={walletCode}
								onChange={(e) => setWalletCode(e.target.value)}
								maxLength={6}
								required={method === "WALLET"}
							/>
						</>
					) : (
						<>
							<label className="mb-1 block text-xs text-neutral-100">Amount received</label>
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
									className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2.5 text-sm text-neutral-50 pr-20"
									required
								/>
								<button
									type="button"
									onClick={() => {
										setOpen(true);
										setHasTypedOnKeypad(false);
									}}
									className="absolute inset-y-0 right-1 my-1 rounded-full bg-emerald-500/20 px-3 text-[11px] sm:text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
								>
									Keypad
								</button>
							</div>
						</>
					)}
				</div>
			</div>

			<button
				type="button"
				onClick={() => {
					// Do a simple client-side check: amount should cover the bill total.
					// For wallet, amount is always exactly the bill amount effectively, 
					// but we still check if they entered a code.

					if (method === "WALLET") {
						if (!walletCode || walletCode.length < 6) {
							setValidationError("Please enter a valid 6-digit payment code.");
							return;
						}
					} else if (parsedAmount + 0.0001 < suggestedAmount) {
						setValidationError("Amount cannot be less than the bill total.");
						return;
					}
					setValidationError(null);
					// Close keypad (if open) and ask for final confirmation.
					setOpen(false);
					setConfirmOpen(true);
				}}
				className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm sm:text-base font-medium text-white hover:bg-neutral-800 active:scale-[0.99]"
			>
				Pay &amp; Close
			</button>
			<p className="mt-2 text-[11px] sm:text-xs text-neutral-200">
				On pay, table time is finalized and stored on the order.
			</p>
			{/* 
				Show a simple change helper so staff can see how much to return.
				This uses the current amount minus the suggested total from the order.
			*/}
			<div className="mt-2 text-[11px] sm:text-xs text-neutral-200">
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
			{
				isMounted && open &&
				/* 
					Centered keypad overlay:
					- Matches the confirmation dialog pattern.
					- Keeps keys large and easy to hit while making the layout feel tidier.
				*/
				createPortal(
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
						<div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 pt-3 text-center shadow-lg shadow-black/70">
							{/* Simple grab handle so it visually reads as a sheet */}
							<div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-700" />
							<div className="mb-2 text-xs text-neutral-400">Enter amount</div>
							<div className="mb-4 rounded border border-emerald-400/40 bg-black/60 px-3 py-2 font-mono text-lg text-emerald-200">
								{formatCurrency(parsedAmount)}
							</div>
							<div className="grid grid-cols-3 gap-2 text-sm sm:text-base">
								{["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "00"].map((key) => (
									<button
										key={key}
										type="button"
										onClick={() => handleKeyPress(key)}
										className="rounded-xl bg-neutral-800 px-4 py-3 font-medium text-neutral-50 shadow-sm shadow-black/60 hover:bg-neutral-700 active:scale-95"
									>
										{key}
									</button>
								))}
							</div>
							<div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
								<button
									type="button"
									onClick={() => handleKeyPress("C")}
									className="rounded-xl bg-red-600/80 px-4 py-3 font-medium text-white shadow-sm shadow-black/60 hover:bg-red-500 active:scale-95"
								>
									Clear
								</button>
								<button
									type="button"
									onClick={() => handleKeyPress("⌫")}
									className="rounded-xl bg-neutral-800 px-4 py-3 font-medium text-neutral-50 shadow-sm shadow-black/60 hover:bg-neutral-700 active:scale-95"
								>
									⌫
								</button>
								<button
									type="button"
									onClick={() => setOpen(false)}
									className="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-900 shadow-sm shadow-black/60 hover:bg-emerald-400 active:scale-95"
								>
									Done
								</button>
							</div>
						</div>
					</div>,
					document.body)
			}

			{/* 
				Confirmation modal: avoids accidental payments.
				Shows method, bill, cash, and change before we submit to the server.
			*/}
			{
				isMounted && confirmOpen &&
				createPortal(
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
						<div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-50 shadow-lg shadow-black/70">
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
									className="rounded-full border border-white/20 px-3 py-2 text-xs sm:text-sm hover:bg-white/10"
								>
									Cancel
								</button>
								<button
									type="button"
									onClick={async () => {
										// FIXING BOSS: ensure the confirm button always performs the correct action
										// even though it lives in a portal outside the form element.

										// For WALLET, we assume exact payment (amount check is skipped).
										// For others, we verify the amount covers the bill.
										if (method !== "WALLET" && parsedAmount + 0.0001 < suggestedAmount) {
											setValidationError("Amount cannot be less than the bill total.");
											return;
										}
										setValidationError(null);

										if (isOnline) {
											// For online flow we programmatically submit the original form.
											// Using requestSubmit keeps the browser's native form handling.
											if (method === "WALLET") {
												setConfirmOpen(false);
												// Handle Wallet Payment Manually
												try {
													const res = await processPaymentCode(sessionId, walletCode, suggestedAmount);
													if (res.success) {
														// Redirect handled in server action? No, it returns result.
														// We need to redirect manually or rely on `processPaymentCode` doing it?
														// `payOrderAction` redirects. 
														// `processPaymentCode` returns object.
														// We should reload to show closed state or redirect to Home.
														window.location.href = "/pos";
													} else {
														setValidationError(res.error || "Wallet payment failed");
													}
												} catch (err: any) {
													setValidationError(err.message || "An error occurred");
												}
											} else {
												formRef.current?.requestSubmit();
											}
											return;
										}

										// When offline we queue a sale_created operation instead of
										// calling the server action. This lets the POS close the
										// table locally and sync the payment when back online.
										setConfirmOpen(false);
										await queueSaleCreated({
											sessionId,
											method,
											tenderedAmount: parsedAmount,
											suggestedAmount,
											capturedAt: new Date().toISOString(),
										});
										setOfflineInfo(
											"Payment queued while offline. The session will be finalized on the server once the connection is restored.",
										);
										// Let the parent know that a closing payment has been queued
										// so it can lock the cart UI to avoid double-charging.
										if (onOfflineQueued) {
											onOfflineQueued();
										}
									}}
									className="rounded-full bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-medium text-neutral-900 hover:bg-emerald-400 active:scale-[0.99] disabled:cursor-not-allowed"
								>
									Confirm &amp; pay
								</button>
							</div>
						</div>
					</div>,
					document.body)
			}
		</form >
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-PH", {
		style: "currency",
		currency: "PHP",
		currencyDisplay: "narrowSymbol",
	}).format(n);
}
