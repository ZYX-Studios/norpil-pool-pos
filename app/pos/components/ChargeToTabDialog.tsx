'use client';

import { useState } from "react";
import { chargeToTab } from "@/app/ar-tabs/actions";
import { CustomerSearchDialog } from "./CustomerSearchDialog";

interface ChargeToTabDialogProps {
  sessionId?: string;
  staffId: string;
  onSuccess?: (result: any) => void;
  onError?: (error: string) => void;
  children?: React.ReactNode;
}

export function ChargeToTabDialog({
  sessionId,
  staffId,
  onSuccess,
  onError,
  children
}: ChargeToTabDialogProps) {
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
      const result = await chargeToTab(
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
        setError(result.error || "Failed to charge to tab");
        if (onError) {
          onError(result.error || "Failed to charge to tab");
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

  const handleCustomerSelect = (customer: any) => {
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
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Charge to Tab
        </button>
      )}
      
      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">Charge to Customer Tab</h2>
            
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                {/* Customer Selection */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Customer
                  </label>
                  {customerId ? (
                    <div className="flex items-center justify-between p-3 border rounded-lg">
                      <span>{customerName}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId(null);
                          setCustomerName("");
                        }}
                        className="text-red-600 hover:text-red-800"
                      >
                        Clear
                      </button>
                    </div>
                  ) : (
                    <CustomerSearchDialog
                      onSelect={handleCustomerSelect}
                      trigger={
                        <button
                          type="button"
                          className="w-full p-3 border rounded-lg text-left hover:bg-gray-50"
                        >
                          Select customer...
                        </button>
                      }
                    />
                  )}
                </div>
                
                {/* Amount Input */}
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Amount (PHP)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full p-3 border rounded-lg"
                    placeholder="0.00"
                    required
                  />
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
                    className="flex-1 p-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                    disabled={isSubmitting || !customerId || !amount}
                  >
                    {isSubmitting ? "Processing..." : "Charge to Tab"}
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