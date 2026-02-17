
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

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

async function inspect() {
  console.log("Inspecting 'customers' table...");
  const { data, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
    console.error("Error inspecting customers:", error);
    // Try to list tables via RPC if available, or just fail
  } else {
    console.log("Customers found:", data);
  }
  
  // Try inspecting 'ar_ledger_entries' too
  console.log("Inspecting 'ar_ledger_entries' table...");
  const { data: arData, error: arError } = await supabase.from('ar_ledger_entries').select('*').limit(1);
  if (arError) {
    console.error("Error inspecting ar_ledger_entries:", arError);
  } else {
    console.log("AR Ledger Entries found:", arData);
  }
}

inspect();
