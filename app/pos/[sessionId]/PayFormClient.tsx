'use client';

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { payOrderFormAction } from "./actions";
import { processPaymentCode } from "../wallet-actions";
import { CustomerSearchDialog } from "../components/CustomerSearchDialog";

type PayFormClientProps = {
	sessionId: string;
	suggestedAmount: number;
	totalPaid: number;
	errorCode?: string;
};

// Simple client-side payment form with a tablet-friendly keypad.
export function PayFormClient({
	sessionId,
	suggestedAmount,
	totalPaid,
	errorCode,
}: PayFormClientProps) {
	const formRef = useRef<HTMLFormElement | null>(null);

	const safeSuggested = Number(suggestedAmount) || 0;
	const safeTotalPaid = Number(totalPaid) || 0;
	const remainingBalance = Math.max(0, safeSuggested - safeTotalPaid);

	// Default amount is the remaining balance
	const [amount, setAmount] = useState(() => remainingBalance.toFixed(2));

	// If it's a new open with previous payments, user knows it's partial. 
	// But we want an explicit "Split Bill" toggle for the FIRST split? 
	// Or just allow editing amount > logic handles it?
	// User said "Simpler". "Input how much the split will be".
	// So we always allow editing amount. If amount < remaining, it's a split.
	// But we need to be clear about it.

	const [open, setOpen] = useState(false);
	const [confirmOpen, setConfirmOpen] = useState(false);
	const [hasTypedOnKeypad, setHasTypedOnKeypad] = useState(false);
	const [method, setMethod] = useState<"CASH" | "GCASH" | "CARD" | "WALLET" | "OTHER">("CASH");
	const [walletCode, setWalletCode] = useState("");
	const [validationError, setValidationError] = useState<string | null>(null);
	const [isMounted, setIsMounted] = useState(false);

	// Member Search for tagging
	const [searchOpen, setSearchOpen] = useState(false);
	const [selectedProfile, setSelectedProfile] = useState<{ name: string; id?: string } | null>(null);

	function handleKeyPress(key: string) {
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
		setAmount((prev) => {
			const cleaned = prev.trim();
			if (!hasTypedOnKeypad || cleaned === "" || cleaned === "0" || cleaned === "0.00") {
				setHasTypedOnKeypad(true);
				return key === "00" ? "0" : key;
			}
			return cleaned + key;
		});
	}

	useEffect(() => {
		if (!open) return;
		function onKeyDown(e: KeyboardEvent) {
			const { key } = e;
			if (key >= "0" && key <= "9") { e.preventDefault(); handleKeyPress(key); return; }
			if (key === ".") { e.preventDefault(); handleKeyPress("."); return; }
			if (key === "Backspace") { e.preventDefault(); handleKeyPress("⌫"); return; }
			if (key === "Delete") { e.preventDefault(); handleKeyPress("C"); return; }
			if (key === "Escape") { e.preventDefault(); setOpen(false); }
		}
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [open]);

	useEffect(() => { setIsMounted(true); }, []);

	const parsedAmount = useMemo(() => {
		const cleaned = (amount || "").replace(/[^0-9.]/g, "");
		const value = parseFloat(cleaned);
		return Number.isFinite(value) ? value : 0;
	}, [amount]);

	// Calculate change ONLY if paying full or more? 
	// If partial, change is irrelevant (unless they overpay the partial amount, but we don't track "Cash Handed vs Applied" separately yet).
	// Simplification: Change is (Cash - Remaining). If negative, it means they are paying partial.

	// FIXING BOSS: logic for split bill detection
	// If parsedAmount < remainingBalance, it's a split bill.
	// Use small epsilon for float comparison.
	const isPartial = parsedAmount < (remainingBalance - 0.05);

	const potentialRemaining = Math.max(0, remainingBalance - parsedAmount);
	const change = Math.max(0, parsedAmount - remainingBalance);

	return (
		<>
			<form
				action={payOrderFormAction}
				ref={formRef}
				className="mt-4 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-neutral-50 shadow-sm shadow-black/50 backdrop-blur"
			>
				<input type="hidden" name="sessionId" value={sessionId} />
				<input type="hidden" name="method" value={method} />
				{/* Pass profileId if selected */}
				{selectedProfile?.id && <input type="hidden" name="profileId" value={selectedProfile.id} />}

				<div className="flex justify-between items-start mb-2">
					<div>
						<h2 className="text-sm font-semibold text-neutral-50">Payment</h2>
						<p className="text-xs text-neutral-200">
							{totalPaid > 0 ? "Make a payment for the remaining balance." : "Choose method and confirm payment."}
						</p>
					</div>
					{/* Tag Member Button */}
					<button
						type="button"
						onClick={() => setSearchOpen(true)}
						className="flex items-center gap-2 rounded-lg bg-neutral-800 px-3 py-1.5 text-xs font-medium text-emerald-400 border border-emerald-500/30 hover:bg-neutral-700 transition"
					>
						{selectedProfile ? (
							<>
								<span className="text-white">{selectedProfile.name}</span>
								<span className="text-neutral-500">✕</span>
							</>
						) : (
							<>
								<span>+ Tag Member</span>
							</>
						)}
					</button>
				</div>

				{selectedProfile && (
					<div className="mb-3 flex items-center justify-between rounded-lg bg-emerald-900/20 px-3 py-2 border border-emerald-500/20">
						<div className="text-xs text-emerald-200">
							Billing to: <span className="font-bold text-white">{selectedProfile.name}</span>
						</div>
						<button
							type="button"
							onClick={() => setSelectedProfile(null)}
							className="text-neutral-400 hover:text-white"
						>
							Clear
						</button>
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
						{method === "WALLET" && (
							<div className="mb-3">
								<label className="mb-1 block text-xs text-neutral-100">Payment Code</label>
								<input
									type="text"
									placeholder="Enter code"
									className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2.5 text-sm text-neutral-50 tracking-widest font-mono"
									value={walletCode}
									onChange={(e) => setWalletCode(e.target.value)}
									maxLength={6}
									required={method === "WALLET"}
								/>
							</div>
						)}

						<label className="mb-1 block text-xs text-neutral-100">Payment Amount</label>
						<div className="relative">
							<input
								name="tenderedAmount"
								type="text"
								inputMode="decimal"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								onFocus={() => { setOpen(true); setHasTypedOnKeypad(false); }}
								className="w-full rounded border border-emerald-400/40 bg-black/40 px-3 py-2.5 text-sm text-neutral-50 pr-20 font-bold"
								required
							/>
							<button
								type="button"
								onClick={() => { setOpen(true); setHasTypedOnKeypad(false); }}
								className="absolute inset-y-0 right-1 my-1 rounded-full bg-emerald-500/20 px-3 text-[11px] sm:text-xs font-medium text-emerald-100 hover:bg-emerald-500/30"
							>
								Keypad
							</button>
						</div>
					</div>
				</div>

				<button
					type="button"
					onClick={() => {
						if (method === "WALLET") {
							if (!walletCode || walletCode.length < 6) {
								setValidationError("Please enter a valid 6-digit payment code.");
								return;
							}
						} else if (parsedAmount <= 0) {
							setValidationError("Amount must be greater than zero.");
							return;
						}
						// For partials, allow any amount > 0.
						setValidationError(null);
						setOpen(false);
						setConfirmOpen(true);
					}}
					className="w-full rounded-full bg-neutral-900 px-4 py-3 text-sm sm:text-base font-medium text-white hover:bg-neutral-800 active:scale-[0.99]"
				>
					{isPartial ? `Split Bill: Pay ${formatCurrency(parsedAmount)}` : (totalPaid > 0 ? "Pay Remaining & Close" : "Pay & Close")}
				</button>

				<div className="mt-2 text-[11px] sm:text-xs text-neutral-200 space-y-1">
					<div className="flex justify-between">
						<span>Total Bill</span>
						<span className="font-mono">{formatCurrency(suggestedAmount)}</span>
					</div>
					{totalPaid > 0 && (
						<div className="flex justify-between text-emerald-300">
							<span>Already Paid</span>
							<span className="font-mono">- {formatCurrency(totalPaid)}</span>
						</div>
					)}
					<div className="flex justify-between font-bold text-white border-t border-white/10 pt-1">
						<span>Remaining</span>
						<span className="font-mono">{formatCurrency(remainingBalance)}</span>
					</div>

					{!isPartial && change > 0 && (
						<div className="flex justify-between font-semibold text-emerald-200 mt-2">
							<span>Change</span>
							<span className="font-mono">{formatCurrency(change)}</span>
						</div>
					)}
				</div>

				{isMounted && open && createPortal(
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
						<div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 pt-3 text-center shadow-lg shadow-black/70">
							<div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-neutral-700" />
							<div className="mb-2 text-xs text-neutral-400">Enter Payment Amount</div>
							<div className="mb-4 rounded border border-emerald-400/40 bg-black/60 px-3 py-2 font-mono text-lg text-emerald-200">
								{formatCurrency(parsedAmount)}
							</div>
							<div className="grid grid-cols-3 gap-2 text-sm sm:text-base">
								{["1", "2", "3", "4", "5", "6", "7", "8", "9", ".", "0", "00"].map((key) => (
									<button key={key} type="button" onClick={() => handleKeyPress(key)} className="rounded-xl bg-neutral-800 px-4 py-3 font-medium text-neutral-50 shadow-sm shadow-black/60 hover:bg-neutral-700 active:scale-95">{key}</button>
								))}
							</div>
							<div className="mt-3 grid grid-cols-3 gap-2 text-xs sm:text-sm">
								<button type="button" onClick={() => handleKeyPress("C")} className="rounded-xl bg-red-600/80 px-4 py-3 font-medium text-white shadow-sm shadow-black/60 hover:bg-red-500 active:scale-95">Clear</button>
								<button type="button" onClick={() => handleKeyPress("⌫")} className="rounded-xl bg-neutral-800 px-4 py-3 font-medium text-neutral-50 shadow-sm shadow-black/60 hover:bg-neutral-700 active:scale-95">⌫</button>
								<button type="button" onClick={() => setOpen(false)} className="rounded-xl bg-emerald-500 px-4 py-3 font-medium text-neutral-900 shadow-sm shadow-black/60 hover:bg-emerald-400 active:scale-95">Done</button>
							</div>
						</div>
					</div>, document.body
				)}

				{/* Confirmation Modal */}
				{isMounted && confirmOpen && createPortal(
					<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
						<div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-900 p-4 text-sm text-neutral-50 shadow-lg shadow-black/70">
							<h3 className="mb-2 text-base font-semibold">Confirm Payment</h3>
							<p className="mb-3 text-xs text-neutral-300">Confirm payment details below.</p>
							<div className="space-y-1 text-xs">
								<div className="flex justify-between"><span>Method</span><span className="font-medium">{method}</span></div>
								{selectedProfile && <div className="flex justify-between"><span>Payer</span><span className="font-bold text-white">{selectedProfile.name}</span></div>}
								<div className="flex justify-between border-t border-white/10 pt-1 mt-1"><span>Remaining Bill</span><span className="font-mono text-neutral-400">{formatCurrency(remainingBalance)}</span></div>
								<div className="flex justify-between"><span>Amount To Pay</span><span className="font-mono text-white text-lg font-bold">{formatCurrency(parsedAmount)}</span></div>
								{isPartial ? (
									<div className="mt-2 text-center text-amber-300 font-medium">⚠️ Partial Payment: Balance Remaining {formatCurrency(potentialRemaining)}</div>
								) : (change > 0 && <div className="flex justify-between font-semibold text-emerald-200 mt-1"><span>Change</span><span className="font-mono">{formatCurrency(change)}</span></div>)}
							</div>
							<div className="mt-5 flex justify-end gap-2">
								<button type="button" onClick={() => setConfirmOpen(false)} className="rounded-full border border-white/20 px-3 py-2 text-xs sm:text-sm hover:bg-white/10">Cancel</button>
								<button type="button" onClick={async () => {
									if (method === "WALLET") {
										setConfirmOpen(false);
										try {
											const res = await processPaymentCode(sessionId, walletCode, parsedAmount, selectedProfile?.id);
											if (res.success) window.location.href = "/pos";
											else setValidationError(res.error || "Wallet payment failed");
										} catch (err: any) { setValidationError(err.message || "Error"); }
									} else {
										formRef.current?.requestSubmit();
									}
								}} className="rounded-full bg-emerald-500 px-4 py-2 text-xs sm:text-sm font-medium text-neutral-900 hover:bg-emerald-400 active:scale-[0.99]">{isPartial ? "Pay Partial" : "Pay & Close"}</button>
							</div>
						</div>
					</div>, document.body
				)}
			</form>

			<CustomerSearchDialog
				isOpen={searchOpen}
				onClose={() => setSearchOpen(false)}
				onSelectCustomer={(res) => {
					setSelectedProfile({ name: res.name, id: res.id });
					setSearchOpen(false);
				}}
			/>
		</>
	);
}

function formatCurrency(n: number) {
	return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", currencyDisplay: "narrowSymbol" }).format(n);
}
