'use client';

import { useState } from "react";
import { makePaymentToTab } from "@/app/ar-tabs/actions";
import { CustomerSearchDialog } from "./CustomerSearchDialog";

interface PaymentToTabDialogProps {
  sessionId?: string;
  staffId: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

export function PaymentToTabDialog({
  sessionId,
  staffId,
  onSuccess,
  onError,
  children
}: PaymentToTabDialogProps) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerName, setCustomerName] = useState("");
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
    setError(null);
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
            <p className="text-gray-600 mb-4 text-sm">
              Accept payment against a customer's tab balance.
            </p>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer *
                  </label>
                  {customerId ? (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <span className="font-medium">{customerName}</span>
                        <div className="text-sm text-gray-500">
                          ID: {customerId.substring(0, 8)}...
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId(null);
                          setCustomerName("");
                        }}
                        className="text-red-600 hover:text-red-800 text-sm"
                      >
                        Change
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          // We need to implement a proper customer search modal
                          // For now, we'll use a simple input
                          const customerId = prompt("Enter customer ID:");
                          const customerName = prompt("Enter customer name:");
                          if (customerId && customerName) {
                            handleCustomerSelect({ id: customerId, name: customerName });
                          }
                        }}
                        className="w-full p-3 border rounded-lg text-left hover:bg-gray-50 flex items-center justify-between"
                      >
                        <span>Select customer...</span>
                        <span className="text-gray-400">▼</span>
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        Note: Full customer search dialog needs integration
                      </p>
                    </div>
                  )}
                </div>
                
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Payment Amount (PHP) *
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
                  <p className="text-sm text-gray-500 mt-1">
                    Enter the amount the customer is paying towards their tab.
                  </p>
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
                    {isSubmitting ? "Processing..." : "Accept Payment"}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}