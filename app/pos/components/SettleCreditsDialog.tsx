'use client';

import { useState } from "react";
import { makePaymentToTab } from "@/app/ar-tabs/actions";
import { CustomerSearchDialog } from "./CustomerSearchDialog";

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
  const [customerBalance, setCustomerBalance] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
    if (customerBalance !== null && amountCents > customerBalance) {
      setError(`Payment cannot exceed current balance of ₱${(customerBalance / 100).toFixed(2)}`);
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
        setCustomerBalance(null);
        
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
    setCustomerName(customer.name);
    setCustomerBalance(customer.balance_cents || 0);
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Settle Customer Credits</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer
                  </label>
                  {customerId ? (
                    <div className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{customerName}</span>
                        <button
                          type="button"
                          onClick={() => {
                            setCustomerId(null);
                            setCustomerName("");
                            setCustomerBalance(null);
                          }}
                          className="text-red-600 hover:text-red-800 text-sm"
                        >
                          Change
                        </button>
                      </div>
                      {customerBalance !== null && (
                        <div className="text-sm">
                          <span className="text-gray-600">Current Balance: </span>
                          <span className={`font-semibold ${
                            customerBalance > 0 ? 'text-red-600' : 
                            customerBalance < 0 ? 'text-green-600' : 
                            'text-gray-600'
                          }`}>
                            {formatCurrency(customerBalance)}
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => setCustomerSearchOpen(true)}
                        className="w-full p-3 border rounded-lg text-left hover:bg-gray-50"
                      >
                        Select customer...
                      </button>
                    </div>
                  )}
                </div>
                
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Payment Amount (PHP)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-3 text-gray-500">₱</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className="w-full p-3 pl-8 border rounded-lg"
                      placeholder="0.00"
                      required
                    />
                  </div>
                  {customerBalance !== null && customerBalance > 0 && (
                    <div className="mt-2 space-y-1">
                      <div className="text-sm text-gray-600">
                        Quick payment options:
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setAmount((customerBalance / 100).toFixed(2))}
                          className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                        >
                          Pay Full Balance
                        </button>
                        <button
                          type="button"
                          onClick={() => setAmount((customerBalance / 2 / 100).toFixed(2))}
                          className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                        >
                          Pay Half
                        </button>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Error Display */}
                {error && (
                  <div className="p-3 bg-red-50 text-red-700 rounded-lg">
                    {error}
                  </div>
                )}
                
                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="flex-1 p-3 border rounded-lg hover:bg-gray-50"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 p-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
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
    </>
  );
}
