// Database types for AR Tabs MVP
// This file should be updated when Supabase types are generated

export type CustomerStatus = 'active' | 'inactive';
export type LedgerEntryType = 'CHARGE' | 'PAYMENT' | 'ADJUSTMENT';

export interface Customer {
  id: string;
  name: string;
  status: CustomerStatus;
  credit_limit_cents: number;
  created_at: string;
}

export interface ArLedgerEntry {
  id: string;
  customer_id: string;
  amount_cents: number;
  type: LedgerEntryType;
  idempotency_key: string;
  pos_session_id: string | null;
  staff_id: string;
  created_at: string;
}

export interface CustomerBalance {
  id: string;
  name: string;
  status: CustomerStatus;
  credit_limit_cents: number;
  created_at: string;
  balance_cents: number;
  transaction_count: number;
  last_transaction_date: string | null;
}

// Function return types
export interface ChargeToTabResult {
  success: boolean;
  entry_id?: string;
  error?: string;
  new_balance?: number;
}

export interface PaymentToTabResult {
  success: boolean;
  entry_id?: string;
  error?: string;
  new_balance?: number;
}