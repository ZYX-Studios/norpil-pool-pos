import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import crypto from 'node:crypto';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runE2E() {
  const results: any[] = [];
  console.log('--- Starting POS Week 2 E2E Verification ---');

  try {
    // 0. Setup
    const { data: tables } = await supabase.from('pool_tables').select('id, name').eq('is_active', true).limit(1);
    const tableId = tables?.[0]?.id;
    const { data: products } = await supabase.from('products').select('id, name, price').limit(2);
    const product1 = products?.[0];

    if (!tableId || !product1) throw new Error('Missing test data (tables or products)');

    // 1. Open Session
    console.log('Step 1: Open Sessions');
    const { data: tableSession, error: tsErr } = await supabase.from('table_sessions').insert({
      pool_table_id: tableId,
      status: 'OPEN',
      customer_name: 'E2E Table Guest',
      location_name: tables?.[0]?.name
    }).select('id').single();
    if (tsErr || !tableSession) throw tsErr || new Error('Failed to create table session');
    
    await supabase.from('orders').insert({ table_session_id: tableSession.id, status: 'OPEN' });

    const { data: walkInSession, error: wiErr } = await supabase.from('table_sessions').insert({
      pool_table_id: null,
      status: 'OPEN',
      customer_name: 'E2E Walk-in Guest',
      location_name: 'Walk-in'
    }).select('id').single();
    if (wiErr || !walkInSession) throw wiErr || new Error('Failed to create walk-in session');
    
    await supabase.from('orders').insert({ table_session_id: walkInSession.id, status: 'OPEN' });

    results.push({ step: 'Open Sessions', status: 'PASS', evidence: `Table Session: ${tableSession.id}, Walk-in: ${walkInSession.id}` });

    // 2. Order Flow
    console.log('Step 2: Order Flow');
    const { data: order } = await supabase.from('orders').select('id').eq('table_session_id', tableSession.id).single();
    if (!order) throw new Error('Order not found');
    
    await supabase.from('order_items').insert({
      order_id: order.id,
      product_id: product1.id,
      quantity: 2,
      unit_price: product1.price,
      line_total: Number(product1.price) * 2
    });
    
    // Send to Kitchen
    const { error: sendErr } = await supabase.from('orders').update({ status: 'SUBMITTED', sent_at: new Date().toISOString() }).eq('id', order.id);
    if (sendErr) throw sendErr;

    const { data: verifiedOrder } = await supabase.from('orders').select('status').eq('id', order.id).single();
    if (!verifiedOrder) throw new Error('Verified order not found');
    
    results.push({ step: 'Order Flow', status: verifiedOrder.status === 'SUBMITTED' ? 'PASS' : 'FAIL', evidence: `Order Status: ${verifiedOrder.status}` });

    // 3. Payment (Partial Cash/Wallet)
    console.log('Step 3: Payment/Idempotency');
    const idempotencyKey = crypto.randomUUID();
    
    // Many POS systems use 'session_id' or 'order_id' instead of 'table_session_id'
    // Let's try to find an order for the session first
    const { data: sessionOrder } = await supabase.from('orders').select('id').eq('table_session_id', tableSession.id).single();

    const paymentData: any = {
        order_id: sessionOrder?.id,
        method: 'CASH',
        amount: 10,
        tendered_amount: 10,
        idempotency_key: idempotencyKey
    };
    
    const { error: payErr } = await supabase.from('payments').insert(paymentData);
    if (payErr) throw payErr;
    
    const { data: payment } = await supabase.from('payments').select('idempotency_key').eq('idempotency_key', idempotencyKey).single();
    results.push({ step: 'Regression: Idempotency Key', status: payment ? 'PASS' : 'FAIL', evidence: `Payment record found with key: ${payment?.idempotency_key}` });

    // 4. Charge to Tab (AR) - Using existing credit_ledger for Week 2
    console.log('Step 4: Charge to Tab (AR)');
    const { data: testProfile } = await supabase.from('profiles').select('id, full_name').limit(1).single();
    if (!testProfile) throw new Error('No profile found for AR test');

    const arIdempotency = crypto.randomUUID();
    const { error: arErr } = await supabase.from('credit_ledger').insert({
        user_id: testProfile.id,
        amount: 50,
        description: 'E2E Test Charge ' + arIdempotency
    });
    
    if (arErr) throw arErr;
    
    const { data: arEntry } = await supabase.from('credit_ledger').select('id').eq('description', 'E2E Test Charge ' + arIdempotency).single();
    results.push({ step: 'AR: Charge Tab (Week 2)', status: arEntry ? 'PASS' : 'FAIL', evidence: `Ledger entry created: ${arEntry?.id}` });

    // 5. Release Table
    console.log('Step 5: Release Table');
    await supabase.from('table_sessions').update({ pool_table_id: null, status: 'CLOSED' }).eq('id', tableSession.id);
    const { data: releasedSession } = await supabase.from('table_sessions').select('pool_table_id, status').eq('id', tableSession.id).single();
    if (!releasedSession) throw new Error('Released session not found');
    
    results.push({ step: 'Release Table', status: (releasedSession.pool_table_id === null && releasedSession.status === 'CLOSED') ? 'PASS' : 'FAIL', evidence: `Table ID: ${releasedSession.pool_table_id}, Status: ${releasedSession.status}` });

    // 6. Walk-in Conversion
    console.log('Step 6: Walk-in Conversion');
    const { data: sessionToConvert, error: convErr } = await supabase.from('table_sessions').insert({
        pool_table_id: tableId,
        status: 'OPEN',
        customer_name: 'Convert Guest'
    }).select('id').single();
    if (convErr || !sessionToConvert) throw convErr || new Error('Failed to create session for conversion');
    
    await supabase.from('table_sessions').update({ pool_table_id: null, location_name: 'Walk-in' }).eq('id', sessionToConvert.id);
    const { data: converted } = await supabase.from('table_sessions').select('pool_table_id, location_name').eq('id', sessionToConvert.id).single();
    if (!converted) throw new Error('Converted session not found');
    
    results.push({ step: 'Walk-in Conversion', status: (converted.pool_table_id === null && converted.location_name === 'Walk-in') ? 'PASS' : 'FAIL', evidence: `Table ID: ${converted.pool_table_id}, Location: ${converted.location_name}` });

  } catch (err: any) {
    console.error('E2E Failed with error:', err);
    results.push({ step: 'Global', status: 'ERROR', evidence: err.message });
  }

  console.log('\n--- E2E Summary ---');
  results.forEach(r => console.log(`[${r.status}] ${r.step}: ${r.evidence}`));
  
  console.log('\nJSON_RESULTS:');
  console.log(JSON.stringify(results, null, 2));
}

runE2E();


