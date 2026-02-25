'use client';

import { useState, useEffect } from "react";
import { getCustomerLedger } from "@/app/ar-tabs/actions";
import { formatCurrency } from "@/lib/utils";

interface LedgerEntry {
  id: string;
  customer_id: string;
  amount_cents: number;
  type: 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT';
  idempotency_key: string;
  pos_session_id: string | null;
  staff_id: string;
  created_at: string;
  staff?: { name: string };
  pos_session?: { id: string; created_at: string };
}

interface CustomerLedgerDialogProps {
  customerId: string | null;
  customerName?: string;
  isOpen: boolean;
  onClose: () => void;
}

export function CustomerLedgerDialog({
  customerId,
  customerName = '',
  isOpen,
  onClose,
}: CustomerLedgerDialogProps) {
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && customerId) {
      setLoading(true);
      setError(null);
      getCustomerLedger(customerId)
        .then((data: any) => {
          setEntries(data || []);
        })
        .catch((err) => {
          console.error('Failed to load ledger:', err);
          setError('Failed to load transaction history');
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setEntries([]);
    }
  }, [isOpen, customerId]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-PH', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(date);
  };

  const getTypeColor = (type: LedgerEntry['type']) => {
    switch (type) {
      case 'CHARGE':
        return 'text-red-400';
      case 'PAYMENT':
        return 'text-emerald-400';
      case 'ADJUSTMENT':
        return 'text-amber-400';
      default:
        return 'text-neutral-400';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-4xl rounded-2xl bg-neutral-900 border border-neutral-800 p-6 shadow-xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-neutral-100">Transaction History</h2>
            {customerName && (
              <p className="text-sm text-neutral-400 mt-1">
                For {customerName}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-2 rounded-full hover:bg-neutral-800 transition"
          >
            ✕
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-emerald-500 border-r-transparent"></div>
              <p className="mt-4 text-neutral-400">Loading transaction history...</p>
            </div>
          </div>
        ) : error ? (
          <div className="p-6 bg-red-900/30 border border-red-500/30 text-red-400 rounded-lg">
            {error}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center border border-neutral-800 rounded-xl">
            <div className="text-neutral-500 mb-3">📄</div>
            <h3 className="font-medium text-neutral-300 mb-1">No transactions yet</h3>
            <p className="text-sm text-neutral-500">No ledger entries found for this customer.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-neutral-800">
            <table className="w-full">
              <thead className="bg-neutral-800/50">
                <tr>
                  <th className="text-left p-4 text-sm font-medium text-neutral-400 uppercase tracking-wider">Type</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-400 uppercase tracking-wider">Amount</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-400 uppercase tracking-wider">Date/Time</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-400 uppercase tracking-wider">Processed By</th>
                  <th className="text-left p-4 text-sm font-medium text-neutral-400 uppercase tracking-wider">Session</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-neutral-800/30 transition">
                    <td className="p-4">
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(entry.type)} bg-neutral-800/50`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`font-mono font-bold ${entry.type === 'CHARGE' ? 'text-red-400' : 'text-emerald-400'}`}>
                        {formatCurrency(entry.amount_cents / 100)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-neutral-300">
                      {formatDateTime(entry.created_at)}
                    </td>
                    <td className="p-4 text-sm text-neutral-300">
                      {entry.staff?.name || 'Unknown'}
                    </td>
                    <td className="p-4 text-sm text-neutral-300">
                      {entry.pos_session?.id ? `POS ${entry.pos_session.id.slice(0, 8)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex justify-end pt-6 mt-6 border-t border-neutral-800">
          <button
            onClick={onClose}
            className="px-6 py-2 border border-neutral-700 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}