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
      actionType: 'CHARGE_TO_TAB',
      entityType: 'ar_tab_entry',
      entityId: data,
      details: {
        customerId,
        amountCents,
        staffId,
        posSessionId,
        newBalance: balanceData || 0
      }
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
      actionType: 'PAYMENT_TO_TAB',
      entityType: 'ar_tab_entry',
      entityId: data,
      details: {
        customerId,
        amountCents,
        staffId,
        posSessionId,
        newBalance: balanceData || 0
      }
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
    // First, ensure we have the correct customer ID
    // The passed ID might be a profile ID or a customer ID
    // Check if it exists in customers table, if not, it might be a profile ID
    // (auto-create uses profile ID as customer ID, so they should match)

    let actualCustomerId = customerId;

    // Verify the customer exists
    const { data: customerCheck, error: checkError } = await supabase
      .from('customers')
      .select('id')
      .eq('id', customerId)
      .maybeSingle();

    if (!customerCheck) {
      // Not found in customers - might be a profile ID
      // Try to find via customer_balances view which joins profiles
      const { data: balanceCheck, error: balanceError } = await supabase
        .from('customer_balances')
        .select('id')
        .eq('id', customerId)
        .maybeSingle();

      if (balanceCheck) {
        actualCustomerId = balanceCheck.id;
      } else {
        // No customer record exists yet - return empty
        console.log('No customer found for ID:', customerId);
        return [];
      }
    }

    const { data, error } = await supabase
      .from('ar_ledger_entries')
      .select(`
        id,
        customer_id,
        amount_cents,
        type,
        idempotency_key,
        pos_session_id,
        staff_id,
        created_at,
        staff:staff_id (name),
        pos_session:pos_session_id (id, created_at:opened_at)
      `)
      .eq('customer_id', actualCustomerId)
      .order('created_at', { ascending: false })
      .limit(100);

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

export async function ensureGuestCustomer(name: string, phone: string): Promise<{ success: boolean; customerId?: string; error?: string }> {
  const supabase = createSupabaseServerClient();

  try {
    // Validate inputs
    if (!name?.trim() || !phone?.trim()) {
      return { success: false, error: 'Name and phone are required' };
    }

    // Normalize phone: strip spaces, ensure Philippine format? We'll store as provided.
    const normalizedPhone = phone.trim();

    // Look up existing customer by phone
    const { data: existing, error: lookupError } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', normalizedPhone)
      .maybeSingle();

    if (lookupError) {
      console.error('Error looking up customer by phone:', lookupError);
      // Continue, assume not found
    }

    if (existing) {
      return { success: true, customerId: existing.id };
    }

    // Create new guest customer
    const { data: newCustomer, error: createError } = await supabase
      .from('customers')
      .insert({
        name: name.trim(),
        phone: normalizedPhone,
        status: 'active',
        credit_limit_cents: 0 // unlimited
      })
      .select('id')
      .single();

    if (createError) {
      console.error('Error creating guest customer:', createError);
      return { success: false, error: createError.message };
    }

    return { success: true, customerId: newCustomer.id };

  } catch (error: any) {
    console.error('Unexpected error in ensureGuestCustomer:', error);
    return { success: false, error: error.message || 'An unexpected error occurred' };
  }
}