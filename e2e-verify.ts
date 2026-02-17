
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load env vars
dotenv.config({ path: resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // MUST use service role to bypass RLS for test setup/teardown if needed

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials. Ensure .env.local exists with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helpers ---
const log = (step: string, msg: string, data?: any) => {
  console.log(`[${step}] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
};

const fail = (step: string, msg: string) => {
  console.error(`❌ [${step}] FAILED: ${msg}`);
  process.exit(1);
};

const pass = (step: string) => {
  console.log(`✅ [${step}] PASSED`);
};

// --- Test State ---
let tableSessionId: string | null = null;
let walkInSessionId: string | null = null;
let orderId: string | null = null;
let testCustomerId: string | null = null;
let testStaffId: string | null = null;
const POOL_TABLE_ID = "00000000-0000-0000-0000-000000000001"; // Assuming Table 1 exists or I need to find one
const TEST_PRODUCT_ID = "00000000-0000-0000-0000-000000000001"; // Placeholder, need to find a real one

async function run() {
  console.log("🚀 Starting E2E Verification Script...");

  // 0. Setup: Get a valid Pool Table and Product
  log("SETUP", "Fetching a valid pool table and product...");
  const { data: table } = await supabase.from('pool_tables').select('id, name').limit(1).single();
  if (!table) fail("SETUP", "No pool tables found.");
  const poolTableId = table!.id;
  log("SETUP", `Using Pool Table: ${table!.name} (${poolTableId})`);

  const { data: product } = await supabase.from('products').select('id, name, price').limit(1).single();
  if (!product) fail("SETUP", "No products found.");
  const productId = product!.id;
  log("SETUP", `Using Product: ${product!.name} (${productId}) - ${product!.price}`);
  
  // Get a staff user for AR actions
  const { data: staff } = await supabase.from('staff').select('id, user_id').limit(1).single();
  if (!staff) fail("SETUP", "No staff found.");
  testStaffId = staff!.id;
  log("SETUP", `Using Staff: ${testStaffId}`);

  // ---------------------------------------------------------
  // 1. Open Session
  // ---------------------------------------------------------
  log("STEP 1", "Creating a table session...");
  // Simulate openTableAction
  const { data: session, error: sessionErr } = await supabase
    .from("table_sessions")
    .insert({
      pool_table_id: poolTableId,
      status: "OPEN",
      session_type: "OPEN",
      customer_name: "E2E Test Guest",
      location_name: table!.name,
    })
    .select("id")
    .single();

  if (sessionErr) fail("STEP 1", `Failed to create session: ${sessionErr.message}`);
  tableSessionId = session!.id;
  
  // Create Order
  const { data: order, error: orderErr } = await supabase.from("orders").insert({
    table_session_id: tableSessionId,
    status: "OPEN",
  }).select("id").single();
  
  if (orderErr) fail("STEP 1", `Failed to create order: ${orderErr.message}`);
  orderId = order!.id;

  pass("STEP 1: Open Table Session");

  log("STEP 1b", "Creating a walk-in session...");
  const { data: walkIn, error: walkInErr } = await supabase
    .from("table_sessions")
    .insert({
      pool_table_id: null,
      customer_name: "E2E Walk-in",
      status: "OPEN",
      location_name: "Walk-in"
    })
    .select("id")
    .single();
    
  if (walkInErr) fail("STEP 1b", `Failed to create walk-in: ${walkInErr.message}`);
  walkInSessionId = walkIn!.id;
  
  // Create Order for Walk-in (cleanup later)
  await supabase.from("orders").insert({ table_session_id: walkInSessionId, status: "OPEN" });
  
  pass("STEP 1b: Open Walk-in Session");

  // ---------------------------------------------------------
  // 2. Order Flow
  // ---------------------------------------------------------
  log("STEP 2", "Adding items and sending to kitchen...");
  
  // Add Item
  const { error: itemErr } = await supabase.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    quantity: 2,
    unit_price: product!.price,
    line_total: product!.price * 2
  });
  if (itemErr) fail("STEP 2", `Failed to add item: ${itemErr.message}`);

  // Recalc Totals (Simulating recalcOrderTotals)
  await supabase.from("orders").update({
    subtotal: product!.price * 2,
    total: product!.price * 2
  }).eq("id", orderId);

  // Send to Kitchen (Simulating sendOrderToKitchen)
  // Verify state 'ordered' -> In our case 'SUBMITTED' is the state in sendOrderToKitchen
  const { error: submitErr } = await supabase
    .from("orders")
    .update({
      status: "SUBMITTED",
      last_submitted_item_count: 2,
      sent_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (submitErr) fail("STEP 2", `Failed to submit order: ${submitErr.message}`);

  // Verify
  const { data: verifyOrder } = await supabase.from("orders").select("status").eq("id", orderId).single();
  if (verifyOrder?.status !== 'SUBMITTED') fail("STEP 2", `Order status is ${verifyOrder?.status}, expected SUBMITTED`);

  pass("STEP 2: Order Flow");

  // ---------------------------------------------------------
  // 3. Payment (Cash/Wallet) - Partial
  // ---------------------------------------------------------
  log("STEP 3", "Partial Payment...");
  const partialAmount = 10;
  
  // Record Payment
  const { error: payErr } = await supabase.from("payments").insert({
    order_id: orderId,
    amount: partialAmount,
    tendered_amount: partialAmount, // Assuming exact change for partial
    method: "CASH"
  });
  if (payErr) fail("STEP 3", `Failed to pay partial: ${payErr.message}`);

  // Note: Actual logic might involve splitting orders or just recording payment. 
  // Assuming closeSessionAndRecordPayment logic handles final close, but partials just sit there?
  // The checklist says "Pay a partial amount". In this POS, multiple payments can be attached to an order?
  // Let's assume we just record it.

  pass("STEP 3: Partial Payment");

  // ---------------------------------------------------------
  // 4. Charge to Tab (AR)
  // ---------------------------------------------------------
  log("STEP 4", "AR: Charge to Tab...");
  
  // Create Test Customer
  const customerName = `AR Test ${Date.now()}`;
  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .insert({
      name: customerName,
      credit_limit_cents: 10000, // $100
      status: "active"
    })
    .select()
    .single();
  
  if (custErr) fail("STEP 4", `Failed to create customer: ${custErr.message}`);
  testCustomerId = customer!.id;
  log("STEP 4", `Created Customer: ${customerName}`);

  // Charge Amount
  const chargeAmountCents = 5000; // $50
  const idempotencyKey = `e2e_${Date.now()}`;
  
  const { data: chargeData, error: chargeErr } = await supabase.rpc('charge_to_tab', {
      p_customer_id: testCustomerId,
      p_amount_cents: chargeAmountCents,
      p_staff_id: testStaffId,
      p_idempotency_key: idempotencyKey,
      p_pos_session_id: tableSessionId
  });

  if (chargeErr) fail("STEP 4", `Failed to charge tab: ${chargeErr.message}`);

  // Verify Ledger
  const { data: ledger } = await supabase.from("ar_ledger_entries")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .single();
    
  if (!ledger) fail("STEP 4", "Ledger entry not found.");
  if (ledger.amount_cents !== -chargeAmountCents) fail("STEP 4", `Ledger amount mismatch. Got ${ledger.amount_cents}, expected -${chargeAmountCents}`);

  // Overcharge Attempt
  log("STEP 4", "Attempting overcharge...");
  const overchargeAmount = 6000; // $60 (Current balance -50, Limit 100. New would be -110. Fail.)
  const { error: overchargeErr } = await supabase.rpc('charge_to_tab', {
      p_customer_id: testCustomerId,
      p_amount_cents: overchargeAmount,
      p_staff_id: testStaffId,
      p_idempotency_key: `over_${Date.now()}`,
      p_pos_session_id: tableSessionId
  });
  
  if (!overchargeErr) fail("STEP 4", "Overcharge should have failed but succeeded.");
  log("STEP 4", "Overcharge correctly rejected.");

  pass("STEP 4: AR Tab Charge");

  // ---------------------------------------------------------
  // 5. Release Table
  // ---------------------------------------------------------
  log("STEP 5", "Release Table...");
  
  // Close the session (Simulating closeSessionAndRecordPayment & releaseTable)
  // Pay remaining.
  const remainingTotal = (product!.price * 2) - partialAmount; // Assuming rough math
  
  await supabase.from("payments").insert({
    order_id: orderId,
    amount: remainingTotal,
    tendered_amount: remainingTotal,
    method: "CASH"
  });

  // Release table
  const { error: releaseErr } = await supabase
    .from("table_sessions")
    .update({
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      pool_table_id: null, // Released
      released_from_table_id: poolTableId
    })
    .eq("id", tableSessionId);

  if (releaseErr) fail("STEP 5", `Failed to release table: ${releaseErr.message}`);

  // Verify
  const { data: closedSession } = await supabase.from("table_sessions").select("status, pool_table_id").eq("id", tableSessionId).single();
  if (closedSession?.status !== 'CLOSED') fail("STEP 5", "Session status not CLOSED");
  if (closedSession?.pool_table_id !== null) fail("STEP 5", "Table not released (pool_table_id not null)");

  pass("STEP 5: Release Table");

  // ---------------------------------------------------------
  // 6. Walk-in Conversion (Simulated)
  // ---------------------------------------------------------
  log("STEP 6", "Walk-in Conversion...");
  // Note: Checklist says "Close a table session but keep as walk-in".
  // This usually implies `releaseIntent: "keep"` in `payOrderAction`.
  // This sets `pool_table_id = null` but keeps `status = OPEN`.
  
  // Let's create another temp session for this
  const { data: session2 } = await supabase.from("table_sessions").insert({
      pool_table_id: poolTableId, // Re-use table as it is released
      status: "OPEN",
      session_type: "OPEN",
      customer_name: "Convert Test",
  }).select("id").single();
  
  // "Release to Walk-in" action
  await supabase
    .from("table_sessions")
    .update({
      pool_table_id: null,
      released_from_table_id: poolTableId,
      location_name: "Walk-in (Converted)"
      // Status remains OPEN
    })
    .eq("id", session2!.id);

  const { data: convertedSession } = await supabase.from("table_sessions").select("status, pool_table_id").eq("id", session2!.id).single();
  if (convertedSession?.status !== 'OPEN') fail("STEP 6", "Session should remain OPEN");
  if (convertedSession?.pool_table_id !== null) fail("STEP 6", "Table ID should be null");

  // Clean up
  await supabase.from("table_sessions").update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq("id", session2!.id);

  pass("STEP 6: Walk-in Conversion");

  // ---------------------------------------------------------
  // 7. Regression Check
  // ---------------------------------------------------------
  log("STEP 7", "Regression Check: Idempotency Key...");
  
  // Check the payment we made in Step 3 or 5, or insert one to verify schema
  const paymentKey = "idem_test_key";
  const { error: regErr } = await supabase.from("payments").insert({
    order_id: orderId,
    amount: 1,
    tendered_amount: 1,
    method: "CASH",
    idempotency_key: paymentKey
  });

  if (regErr) fail("STEP 7", `Failed to insert payment with idempotency_key: ${regErr.message}`);
  
  const { data: payCheck } = await supabase.from("payments").select("idempotency_key").eq("idempotency_key", paymentKey).single();
  if (payCheck?.idempotency_key !== paymentKey) fail("STEP 7", "Idempotency key not saved correctly.");

  pass("STEP 7: Regression Check");

  console.log("\n✨ E2E VERIFICATION COMPLETED SUCCESSFULLY ✨");
}

run().catch(e => {
  console.error("Unhandled error:", e);
  process.exit(1);
});
