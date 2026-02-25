import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import fs from 'fs';

// --- Setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Load env vars
dotenv.config({ path: resolve(projectRoot, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase credentials.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runE2E() {
  console.log("Starting AR E2E Verification...");

  // 1. Verify 'customers' table existence (bypass cache with fresh client)
  console.log("1. Verifying 'customers' table...");
  
  // Create fresh client to bypass any cached schema
  const freshClient = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false },
    db: { schema: 'public' }
  });
  
  const { error: tableError } = await freshClient.from('customers').select('*').limit(1);
  
  if (tableError) {
    console.error("❌ 'customers' table check failed:", tableError.message);
    console.log("⚠️  Schema cache issue detected. Running independent verification...");
    
    // Run independent verification script
    const { execSync } = await import('child_process');
    try {
      execSync('node scripts/verify-migration-status.mjs', { cwd: projectRoot, stdio: 'inherit' });
      console.log("✅ Independent verification confirms migration is applied.");
      console.log("Proceeding with other E2E tests despite cache issue...");
    } catch (e) {
      console.error("❌ Independent verification failed.");
      process.exit(1);
    }
  } else {
    console.log("✅ 'customers' table exists.");
  }

  // 2. Create Test Customer
  const testCustomerName = `E2E Test Customer ${Date.now()}`;
  const creditLimit = 10000; // $100.00
  console.log(`2. Creating customer: ${testCustomerName} with limit ${creditLimit}`);
  
  const { data: customer, error: createError } = await supabase
    .from('customers')
    .insert({ name: testCustomerName, credit_limit_cents: creditLimit, status: 'active' })
    .select()
    .single();

  if (createError) {
    console.error("❌ Failed to create customer:", createError);
    process.exit(1);
  }
  console.log(`✅ Customer created: ${customer.id}`);

  // 3. Charge to Tab
  console.log("3. Charging $25.00 to customer tab...");
  const { data: chargeResult, error: chargeError } = await supabase.rpc('charge_to_tab', {
    p_customer_id: customer.id,
    p_amount_cents: 2500,
    p_description: 'E2E test charge'
  });

  if (chargeError) {
    console.error("❌ Failed to charge to tab:", chargeError);
    process.exit(1);
  }
  console.log(`✅ Charge successful. Ledger entry ID: ${chargeResult}`);

  // 4. Get Customer Balance
  console.log("4. Getting customer balance...");
  const { data: balanceResult, error: balanceError } = await supabase.rpc('get_customer_balance', {
    p_customer_id: customer.id
  });

  if (balanceError) {
    console.error("❌ Failed to get balance:", balanceError);
    process.exit(1);
  }
  console.log(`✅ Customer balance: $${(balanceResult / 100).toFixed(2)}`);

  // 5. Clean up test data
  console.log("5. Cleaning up test data...");
  const { error: deleteError } = await supabase
    .from('customers')
    .delete()
    .eq('id', customer.id);

  if (deleteError) {
    console.error("⚠️  Failed to clean up test customer (non-fatal):", deleteError);
  } else {
    console.log("✅ Test data cleaned up.");
  }

  console.log("\n🎉 AR E2E Verification PASSED!");
  return true;
}

runE2E().catch(err => {
  console.error("E2E run failed:", err);
  process.exit(1);
});