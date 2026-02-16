
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
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- Helpers ---
const log = (step: string, msg: string, data?: any) => {
  console.log(`[${step}] ${msg}`, data ? JSON.stringify(data, null, 2) : '');
};

const fail = (step: string, msg: string) => {
  console.error(`❌ [${step}] FAILED: ${msg}`);
  // We continue execution instead of exit(1) to test other steps
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
const POOL_TABLE_ID = "00000000-0000-0000-0000-000000000001"; 

async function run() {
  console.log("🚀 Starting E2E Verification Script (Modified for Missing Migration)...");

  // 0. Setup
  log("SETUP", "Fetching a valid pool table and product...");
  const { data: table } = await supabase.from('pool_tables').select('id, name').limit(1).single();
  if (!table) { fail("SETUP", "No pool tables found."); return; }
  const poolTableId = table.id;
  log("SETUP", `Using Pool Table: ${table.name} (${poolTableId})`);

  const { data: product } = await supabase.from('products').select('id, name, price').limit(1).single();
  if (!product) { fail("SETUP", "No products found."); return; }
  const productId = product.id;
  log("SETUP", `Using Product: ${product.name} (${productId}) - ${product.price}`);
  
  const { data: staff } = await supabase.from('staff').select('id, user_id').limit(1).single();
  testStaffId = staff?.id; // Allow null if staff not found (might fail later)
  log("SETUP", `Using Staff: ${testStaffId}`);

  // 1. Open Session
  log("STEP 1", "Creating a table session...");
  const { data: session, error: sessionErr } = await supabase
    .from("table_sessions")
    .insert({
      pool_table_id: poolTableId,
      status: "OPEN",
      session_type: "OPEN",
      customer_name: "E2E Test Guest",
      location_name: table.name,
    })
    .select("id")
    .single();

  if (sessionErr) { fail("STEP 1", `Failed to create session: ${sessionErr.message}`); return; }
  tableSessionId = session!.id;
  
  const { data: order, error: orderErr } = await supabase.from("orders").insert({
    table_session_id: tableSessionId,
    status: "OPEN",
  }).select("id").single();
  
  if (orderErr) { fail("STEP 1", `Failed to create order: ${orderErr.message}`); return; }
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
  else pass("STEP 1b: Open Walk-in Session");

  // 2. Order Flow
  log("STEP 2", "Adding items and sending to kitchen...");
  const { error: itemErr } = await supabase.from("order_items").insert({
    order_id: orderId,
    product_id: productId,
    quantity: 2,
    unit_price: product.price,
    line_total: product.price * 2
  });
  if (itemErr) fail("STEP 2", `Failed to add item: ${itemErr.message}`);

  await supabase.from("orders").update({
    subtotal: product.price * 2,
    total: product.price * 2
  }).eq("id", orderId);

  const { error: submitErr } = await supabase
    .from("orders")
    .update({
      status: "SUBMITTED",
      last_submitted_item_count: 2,
      sent_at: new Date().toISOString()
    })
    .eq("id", orderId);

  if (submitErr) fail("STEP 2", `Failed to submit order: ${submitErr.message}`);
  else pass("STEP 2: Order Flow");

  // 3. Payment (Cash/Wallet) - Partial
  log("STEP 3", "Partial Payment...");
  const partialAmount = 10;
  const { error: payErr } = await supabase.from("payments").insert({
    order_id: orderId,
    amount: partialAmount,
    tendered_amount: partialAmount,
    method: "CASH"
  });
  if (payErr) fail("STEP 3", `Failed to pay partial: ${payErr.message}`);
  else pass("STEP 3: Partial Payment");

  // 4. Charge to Tab (AR) - SKIPPED IF TABLE MISSING
  log("STEP 4", "AR: Charge to Tab (Checking availability)...");
  try {
      const { error: checkTable } = await supabase.from('customers').select('id').limit(1);
      if (checkTable && checkTable.message?.includes("Could not find the table")) {
          fail("STEP 4", "SKIPPED: 'customers' table missing. Migration not applied.");
      } else {
          // Proceed with Step 4
          const customerName = `AR Test ${Date.now()}`;
          const { data: customer, error: custErr } = await supabase
            .from("customers")
            .insert({
              name: customerName,
              credit_limit_cents: 10000,
              status: "active"
            })
            .select()
            .single();
          
          if (custErr) throw custErr;
          testCustomerId = customer!.id;
          log("STEP 4", `Created Customer: ${customerName}`);
        
          const chargeAmountCents = 5000;
          const idempotencyKey = `e2e_${Date.now()}`;
          const { error: chargeErr } = await supabase.rpc('charge_to_tab', {
              p_customer_id: testCustomerId,
              p_amount_cents: chargeAmountCents,
              p_staff_id: testStaffId,
              p_idempotency_key: idempotencyKey,
              p_pos_session_id: tableSessionId
          });
        
          if (chargeErr) throw chargeErr;
          pass("STEP 4: AR Tab Charge");
      }
  } catch (e: any) {
      fail("STEP 4", `Failed: ${e.message}`);
  }

  // 5. Release Table
  log("STEP 5", "Release Table...");
  const remainingTotal = (product.price * 2) - partialAmount;
  await supabase.from("payments").insert({
    order_id: orderId,
    amount: remainingTotal,
    tendered_amount: remainingTotal,
    method: "CASH"
  });

  const { error: releaseErr } = await supabase
    .from("table_sessions")
    .update({
      status: "CLOSED",
      closed_at: new Date().toISOString(),
      pool_table_id: null,
      released_from_table_id: poolTableId
    })
    .eq("id", tableSessionId);

  if (releaseErr) fail("STEP 5", `Failed to release table: ${releaseErr.message}`);
  else pass("STEP 5: Release Table");

  // 6. Walk-in Conversion
  log("STEP 6", "Walk-in Conversion...");
  const { data: session2 } = await supabase.from("table_sessions").insert({
      pool_table_id: poolTableId,
      status: "OPEN",
      session_type: "OPEN",
      customer_name: "Convert Test",
  }).select("id").single();
  
  if (session2) {
      await supabase
        .from("table_sessions")
        .update({
          pool_table_id: null,
          released_from_table_id: poolTableId,
          location_name: "Walk-in (Converted)"
        })
        .eq("id", session2.id);
      pass("STEP 6: Walk-in Conversion");
      
      // Cleanup
      await supabase.from("table_sessions").update({ status: 'CLOSED', closed_at: new Date().toISOString() }).eq("id", session2.id);
  } else {
      fail("STEP 6", "Failed to create temp session for conversion");
  }

  // 7. Regression Check
  log("STEP 7", "Regression Check: Idempotency Key...");
  const paymentKey = `idem_test_${Date.now()}`;
  const { error: regErr } = await supabase.from("payments").insert({
    order_id: orderId,
    amount: 1,
    tendered_amount: 1,
    method: "CASH",
    idempotency_key: paymentKey
  });

  if (regErr) fail("STEP 7", `Failed to insert payment with idempotency_key: ${regErr.message}`);
  else {
      const { data: payCheck } = await supabase.from("payments").select("idempotency_key").eq("idempotency_key", paymentKey).single();
      if (payCheck?.idempotency_key === paymentKey) pass("STEP 7: Regression Check");
      else fail("STEP 7", "Idempotency key check failed");
  }

  console.log("\n✨ E2E VERIFICATION COMPLETED (With known failures) ✨");
}

run().catch(e => {
  console.error("Unhandled error:", e);
});
