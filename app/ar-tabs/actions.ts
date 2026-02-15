'use server'

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logAction } from "@/lib/logger";
import type { ChargeToTabResult, PaymentToTabResult } from "@/lib/types/database";

export async function chargeToTab(
  customerId: string,
  amountCents: number,
  staffId: string,
  posSessionId?: string
): Promise<ChargeToTabResult> {
  const supabase = createSupabaseServerClient();
  
  try {
    // Validate inputs
    if (!customerId || !staffId) {
      return { success: false, error: 'Customer ID and Staff ID are required' };
    }
    
    if (amountCents <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }
    
    // Generate idempotency key
    const idempotencyKey = `charge_${crypto.randomUUID()}`;
    
    // Call the database function
    const { data, error } = await supabase.rpc('charge_to_tab', {
      p_customer_id: customerId,
      p_amount_cents: amountCents,
      p_staff_id: staffId,
      p_idempotency_key: idempotencyKey,
      p_pos_session_id: posSessionId || null
    });
    
    if (error) {
      console.error('Error charging to tab:', error);
      return { success: false, error: error.message };
    }
    
    // Get the new balance
    const { data: balanceData, error: balanceError } = await supabase.rpc('get_customer_balance', {
      customer_uuid: customerId
    });
    
    if (balanceError) {
      console.error('Error getting customer balance:', balanceError);
    }
    
    // Log the action
    await logAction({
      action: 'CHARGE_TO_TAB',
      details: {
        customerId,
        amountCents,
        staffId,
        posSessionId,
        entryId: data,
        newBalance: balanceData || 0
      },
      userId: staffId
    });
    
    return {
      success: true,
      entry_id: data,
      new_balance: balanceData || 0
    };
    
  } catch (error: any) {
    console.error('Unexpected error in chargeToTab:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function makePaymentToTab(
  customerId: string,
  amountCents: number,
  staffId: string,
  posSessionId?: string
): Promise<PaymentToTabResult> {
  const supabase = createSupabaseServerClient();
  
  try {
    // Validate inputs
    if (!customerId || !staffId) {
      return { success: false, error: 'Customer ID and Staff ID are required' };
    }
    
    if (amountCents <= 0) {
      return { success: false, error: 'Amount must be positive' };
    }
    
    // Generate idempotency key
    const idempotencyKey = `payment_${crypto.randomUUID()}`;
    
    // Call the database function
    const { data, error } = await supabase.rpc('make_payment_to_tab', {
      p_customer_id: customerId,
      p_amount_cents: amountCents,
      p_staff_id: staffId,
      p_idempotency_key: idempotencyKey,
      p_pos_session_id: posSessionId || null
    });
    
    if (error) {
      console.error('Error making payment to tab:', error);
      return { success: false, error: error.message };
    }
    
    // Get the new balance
    const { data: balanceData, error: balanceError } = await supabase.rpc('get_customer_balance', {
      customer_uuid: customerId
    });
    
    if (balanceError) {
      console.error('Error getting customer balance:', balanceError);
    }
    
    // Log the action
    await logAction({
      action: 'PAYMENT_TO_TAB',
      details: {
        customerId,
        amountCents,
        staffId,
        posSessionId,
        entryId: data,
        newBalance: balanceData || 0
      },
      userId: staffId
    });
    
    return {
      success: true,
      entry_id: data,
      new_balance: balanceData || 0
    };
    
  } catch (error: any) {
    console.error('Unexpected error in makePaymentToTab:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCustomerBalance(customerId: string): Promise<number> {
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase.rpc('get_customer_balance', {
      customer_uuid: customerId
    });
    
    if (error) {
      console.error('Error getting customer balance:', error);
      return 0;
    }
    
    return data || 0;
  } catch (error) {
    console.error('Unexpected error in getCustomerBalance:', error);
    return 0;
  }
}

export async function getCustomerBalances() {
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('customer_balances')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error getting customer balances:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Unexpected error in getCustomerBalances:', error);
    return [];
  }
}

export async function createCustomer(
  name: string,
  creditLimitCents: number = 0,
  status: 'active' | 'inactive' = 'active'
) {
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('customers')
      .insert({
        name,
        credit_limit_cents: creditLimitCents,
        status
      })
      .select()
      .single();
    
    if (error) {
      console.error('Error creating customer:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, customer: data };
  } catch (error: any) {
    console.error('Unexpected error in createCustomer:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function updateCustomer(
  customerId: string,
  updates: {
    name?: string;
    credit_limit_cents?: number;
    status?: 'active' | 'inactive';
  }
) {
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('customers')
      .update(updates)
      .eq('id', customerId)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating customer:', error);
      return { success: false, error: error.message };
    }
    
    return { success: true, customer: data };
  } catch (error: any) {
    console.error('Unexpected error in updateCustomer:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}

export async function getCustomerLedger(customerId: string) {
  const supabase = createSupabaseServerClient();
  
  try {
    const { data, error } = await supabase
      .from('ar_ledger_entries')
      .select(`
        *,
        staff:staff_id (name),
        pos_session:pos_session_id (id, created_at)
      `)
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error getting customer ledger:', error);
      return [];
    }
    
    return data || [];
  } catch (error) {
    console.error('Unexpected error in getCustomerLedger:', error);
    return [];
  }
}