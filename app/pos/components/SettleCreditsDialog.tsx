'use client';

import { useState, useEffect } from "react";
import { makePaymentToTab, getCustomerBalances } from "@/app/ar-tabs/actions";
import { CustomerSearchDialog } from "./CustomerSearchDialog";
import { CustomerLedgerDialog } from "./CustomerLedgerDialog";

interface CustomerBalance {
  id: string;
  name: string;
  balance_cents: number;
  credit_limit_cents?: number;
}

interface SettleCreditsDialogProps {
  sessionId?: string;
  staffId: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

export function SettleCreditsDialog({
  sessionId,
  staffId,
  onSuccess,
  onError,
  children
}: SettleCreditsDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false);
  const [customerTabBalance, setCustomerTabBalance] = useState<number | null>(null); // AR Tab balance (owed)
  const [customerWalletBalance, setCustomerWalletBalance] = useState<number | null>(null); // Wallet credits
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [customersWithBalance, setCustomersWithBalance] = useState<CustomerBalance[]>([]);
  const [isLoadingBalances, setIsLoadingBalances] = useState(false);
  const [ledgerOpen, setLedgerOpen] = useState(false);

  // Fetch customers with outstanding balances on dialog open
  useEffect(() => {
    if (open) {
      setIsLoadingBalances(true);
      getCustomerBalances()
        .then((data) => {
          // Filter customers with positive balance, sort by balance desc, limit to 10
          const filtered = (data || [])
            .filter((c: CustomerBalance) => (c.balance_cents || 0) > 0)
            .sort((a: CustomerBalance, b: CustomerBalance) => (b.balance_cents || 0) - (a.balance_cents || 0))
            .slice(0, 10);
          setCustomersWithBalance(filtered);
        })
        .catch((err) => {
          console.error("Failed to load customer balances:", err);
        })
        .finally(() => {
          setIsLoadingBalances(false);
        });
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!customerId) {
      setError("Please select a customer");
      return;
    }
    
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      setError("Please enter a valid amount");
      return;
    }
    
    // Check if payment exceeds balance
    if (customerTabBalance !== null && amountCents > customerTabBalance) {
      setError(`Payment cannot exceed current balance of ₱${(customerTabBalance / 100).toFixed(2)}`);
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      const result = await makePaymentToTab(
        customerId,
        amountCents,
        staffId,
        sessionId
      );
      
      if (result.success) {
        setOpen(false);
        setAmount("");
        setCustomerId(null);
        setCustomerName("");
        setCustomerTabBalance(null);
        setCustomerWalletBalance(null);
        
        if (onSuccess) {
          onSuccess(result);
        }
      } else {
        setError(result.error || "Failed to process payment");
        if (onError) {
          onError(result.error || "Failed to process payment");
        }
      }
    } catch (err: any) {
      const errorMsg = err.message || "An unexpected error occurred";
      setError(errorMsg);
      if (onError) {
        onError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerSelect = (result: any) => {
    const customer = result.fullCustomer || result;
    setCustomerId(customer.id);
    setCustomerName(customer.full_name || customer.name || "Unknown");
    // AR Tab balance (amount owed, in cents) - positive means customer owes money
    setCustomerTabBalance(customer.balance_cents || 0);
    // Wallet credits (in pesos, not cents) - this is their prepaid balance
    setCustomerWalletBalance(customer.wallet?.balance ?? null);
    setError(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(amount / 100);
  };

  return (
    <>
      {children ? (
        <div onClick={() => setOpen(true)}>
          {children}
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
        >
          Settle Credits
        </button>
      )}
      
      {open && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-bold text-neutral-100 mb-4">Settle Customer Credits</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Customer
                  </label>
                  {customerId ? (
                    <div className="p-3 border border-neutral-700 rounded-lg bg-neutral-800/50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-neutral-100">{customerName}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setLedgerOpen(true)}
                            className="text-sm text-emerald-400 hover:text-emerald-300 transition"
                          >
                            View History
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomerId(null);
                              setCustomerName("");
                              setCustomerTabBalance(null);
                              setCustomerWalletBalance(null);
                            }}
                            className="text-sm text-neutral-400 hover:text-neutral-200 transition"
                          >
                            Change
                          </button>
                        </div>
                      </div>
                      {/* Customer Balances */}
                      <div className="flex flex-col gap-1 text-sm">
                        {/* Wallet Credits (prepaid balance) */}
                        {customerWalletBalance !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Wallet Credits:</span>
                            <span className="font-semibold text-emerald-400">
                              ₱{customerWalletBalance.toFixed(2)}
                            </span>
                          </div>
                        )}
                        {/* AR Tab Balance (amount owed) */}
                        {customerTabBalance !== null && (
                          <div className="flex items-center justify-between">
                            <span className="text-neutral-400">Tab Balance:</span>
                            <span className={`font-semibold ${
                              customerTabBalance > 0 ? 'text-red-400' : 
                              customerTabBalance < 0 ? 'text-emerald-400' : 
                              'text-neutral-400'
                            }`}>
                              {formatCurrency(customerTabBalance)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Quick Select: Customers with Outstanding Balances */}
                      {isLoadingBalances ? (
                        <div className="p-3 border border-neutral-800 rounded-lg bg-neutral-800/30 text-neutral-500 text-sm text-center">
                          Loading customers...
                        </div>
                      ) : customersWithBalance.length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-2">
                            Quick Select — Outstanding Balances
                          </div>
                          <div className="max-h-40 overflow-y-auto space-y-1 pr-1 scrollbar-thin">
                            {customersWithBalance.map((customer) => (
                              <button
                                key={customer.id}
                                type="button"
                                onClick={() => {
                                  setCustomerId(customer.id);
                                  setCustomerName(customer.name);
                                  setCustomerTabBalance(customer.balance_cents);
                                  setCustomerWalletBalance(null);
                                  setError(null);
                                }}
                                className="w-full flex items-center justify-between p-2.5 border border-neutral-800 rounded-lg bg-neutral-800/40 hover:bg-neutral-800 hover:border-emerald-500/30 transition group"
                              >
                                <span className="text-sm text-neutral-300 group-hover:text-neutral-100 truncate pr-2">
                                  {customer.name}
                                </span>
                                <span className="text-sm font-semibold text-red-400 shrink-0">
                                  {formatCurrency(customer.balance_cents)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="p-3 border border-neutral-800 rounded-lg bg-neutral-800/30 text-neutral-500 text-sm text-center">
                          No customers with outstanding balances
                        </div>
                      )}
                      
                      {/* Search All Customers */}
                      <button
                        type="button"
                        onClick={() => setCustomerSearchOpen(true)}
                        className="w-full p-3 border border-neutral-700 rounded-lg bg-neutral-800/50 text-left text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 transition"
                      >
                        🔍 Search all customers...
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-1">
                    Payment Amount (PHP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-neutral-500">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full p-3 pl-8 border border-neutral-700 rounded-lg bg-neutral-800/50 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {customerTabBalance !== null && customerTabBalance > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-neutral-400">
                        Quick payment options:
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAmount((customerTabBalance / 100).toFixed(2))}
                          className="px-3 py-1.5 text-sm bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 rounded-lg hover:bg-emerald-900/50 transition"
                        >
                          Pay Full Balance
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmount((customerTabBalance / 2 / 100).toFixed(2))}
                          className="px-3 py-1.5 text-sm bg-neutral-800 text-neutral-300 border border-neutral-700 rounded-lg hover:bg-neutral-700 transition"
                        >
                          Pay Half
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-900/30 border border-red-500/30 text-red-400 rounded-lg">
                    {error}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 p-3 border border-neutral-700 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition"
                    disabled={isSubmitting || !customerId || !amount}
                  >
                    {isSubmitting ? "Processing..." : "Apply Payment"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      <CustomerSearchDialog
        isOpen={customerSearchOpen}
        onClose={() => setCustomerSearchOpen(false)}
        onSelectCustomer={(res) => {
          if (res.fullCustomer || res.id) {
            handleCustomerSelect(res.fullCustomer || { id: res.id, name: res.name });
            setCustomerSearchOpen(false);
          } else {
            alert("Please select a registered customer/member for AR Tabs.");
          }
        }}
      />
      <CustomerLedgerDialog
        customerId={customerId}
        customerName={customerName}
        isOpen={ledgerOpen}
        onClose={() => setLedgerOpen(false)}
      />
    </>
  );
}
