import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars from .env.local if present, otherwise rely on process.env
try {
  const envConfig = dotenv.parse(fs.readFileSync('.env.local'));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} catch (e) {
  // ignore
}

const NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!NEXT_PUBLIC_SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkMigration() {
  console.log('Checking for AR Tabs tables...');
  
  // Check for customers table
  const { error: custError } = await supabase.from('customers').select('count', { count: 'exact', head: true });
  
  if (custError && custError.code === '42P01') { // undefined_table
    console.log('❌ Table public.customers DOES NOT exist.');
    return false;
  } else if (custError) {
    console.error('Error checking customers:', custError);
    return false;
  }
  
  console.log('✅ Table public.customers EXISTS.');

  // Check for ar_ledger_entries table
  const { error: ledgerError } = await supabase.from('ar_ledger_entries').select('count', { count: 'exact', head: true });
  
  if (ledgerError && ledgerError.code === '42P01') {
    console.log('❌ Table public.ar_ledger_entries DOES NOT exist.');
    return false;
  }
  
  console.log('✅ Table public.ar_ledger_entries EXISTS.');
  return true;
}

async function applyMigration() {
  const migrationPath = path.join(process.cwd(), 'supabase/migrations/20260215232046_ar_tabs_mvp.sql');
  if (!fs.existsSync(migrationPath)) {
    console.error(`Migration file not found at ${migrationPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(migrationPath, 'utf8');
  console.log(`\nApplying migration: ${path.basename(migrationPath)}...`);
  
  // We can't run raw SQL via supabase-js client directly unless we have a specific RPC or use the rest interface if enabled (unlikely for DDL).
  // However, the instructions imply I should "verify/apply via Node script".
  // Without direct SQL access via client, I cannot APPLY DDL.
  // Wait, I am an agent. I can't apply DDL via supabase-js standard client.
  // I need the Postgres connection string to use 'pg' lib or similar, BUT I don't have the password for 'postgres' user exposed in .env.local usually, only service role key.
  
  // Actually, checking previous context, I might not have the DB password.
  // If I can't apply, I must report status.
  // But the prompt says "pick ONE unblock path and execute it now... C) run a Node verification/apply script".
  // If I cannot apply, I can at least verify.
  // Let's check if I have the connection string.
  
  console.log('⚠️ Cannot apply DDL via supabase-js client. Reporting status only.');
}

async function run() {
    const exists = await checkMigration();
    if (!exists) {
        console.log('\nMigration is MISSING. I cannot apply it via supabase-js (requires direct SQL access).');
        console.log('Please apply supabase/migrations/20260215232046_ar_tabs_mvp.sql manually or provide postgres connection string.');
    } else {
        console.log('\nMigration is APPLIED.');
    }
}

run();
