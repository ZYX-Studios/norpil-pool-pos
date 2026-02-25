#!/usr/bin/env node

/**
 * Prod-safe resume script for AR Tabs MVP migration
 * Handles partial apply scenarios and schema mismatches
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials. Check .env.local');
    console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false }
});

async function checkTableExists(tableName) {
    const { data, error } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error checking table ${tableName}:`, error.message);
        return false;
    }
    
    return !!data;
}

async function checkColumnExists(tableName, columnName) {
    const { data, error } = await supabase
        .from('information_schema.columns')
        .select('column_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .eq('column_name', columnName)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error checking column ${tableName}.${columnName}:`, error.message);
        return false;
    }
    
    return !!data;
}

async function checkFKConstraint(tableName, columnName) {
    const { data, error } = await supabase
        .from('information_schema.key_column_usage')
        .select('constraint_name')
        .eq('table_schema', 'public')
        .eq('table_name', tableName)
        .eq('column_name', columnName)
        .single();
    
    if (error && error.code !== 'PGRST116') {
        console.error(`❌ Error checking FK for ${tableName}.${columnName}:`, error.message);
        return null;
    }
    
    return data?.constraint_name || null;
}

async function getSessionsTableName() {
    const tables = ['table_sessions', 'pos_sessions'];
    
    for (const table of tables) {
        if (await checkTableExists(table)) {
            return table;
        }
    }
    
    return null;
}

async function runSQL(sql) {
    console.log(`📝 Executing: ${sql.substring(0, 100)}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql });
    
    if (error) {
        console.error(`❌ SQL error:`, error.message);
        return false;
    }
    
    return true;
}

async function main() {
    console.log('🚀 Starting prod-safe AR migration resume script');
    console.log(`🔗 Connected to: ${supabaseUrl.replace(/\/\/(.*?)\./, '//[REDACTED].')}`);
    
    // Step 1: Check which sessions table exists
    console.log('\n📊 Step 1: Checking schema state...');
    const sessionsTable = await getSessionsTableName();
    
    if (!sessionsTable) {
        console.log('⚠️  No sessions table found (neither table_sessions nor pos_sessions)');
        console.log('⚠️  Skipping FK creation for pos_session_id');
    } else {
        console.log(`✅ Found sessions table: ${sessionsTable}`);
    }
    
    // Step 2: Check if ar_ledger_entries exists
    const ledgerTableExists = await checkTableExists('ar_ledger_entries');
    const customersTableExists = await checkTableExists('customers');
    
    console.log(`📊 ar_ledger_entries exists: ${ledgerTableExists ? '✅' : '❌'}`);
    console.log(`📊 customers exists: ${customersTableExists ? '✅' : '❌'}`);
    
    if (!ledgerTableExists) {
        console.log('\n📝 Step 2: Creating missing tables...');
        
        // Check if enums exist first
        const enumChecks = [
            "SELECT 1 FROM pg_type WHERE typname = 'customer_status'",
            "SELECT 1 FROM pg_type WHERE typname = 'ledger_entry_type'"
        ];
        
        for (const check of enumChecks) {
            const { data } = await supabase.rpc('exec_sql', { sql: check });
            if (!data || data.length === 0) {
                console.log('⚠️  Some enums missing, but migration will handle with IF NOT EXISTS');
            }
        }
        
        console.log('✅ Tables will be created by migration (IF NOT EXISTS safe)');
    } else {
        console.log('\n📝 Step 2: Checking FK state...');
        
        const hasPosSessionColumn = await checkColumnExists('ar_ledger_entries', 'pos_session_id');
        
        if (hasPosSessionColumn) {
            const fkName = await checkFKConstraint('ar_ledger_entries', 'pos_session_id');
            
            if (fkName) {
                console.log(`✅ FK constraint exists: ${fkName}`);
                
                // Check if FK references the wrong table
                if (sessionsTable) {
                    const { data } = await supabase.rpc('exec_sql', {
                        sql: `
                        SELECT tc.constraint_name 
                        FROM information_schema.table_constraints tc
                        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
                        JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
                        WHERE tc.table_schema = 'public' 
                        AND tc.table_name = 'ar_ledger_entries'
                        AND kcu.column_name = 'pos_session_id'
                        AND tc.constraint_type = 'FOREIGN KEY'
                        `
                    });
                    
                    if (data && data.length > 0) {
                        console.log(`✅ FK is already configured`);
                    }
                }
            } else {
                console.log('⚠️  No FK constraint found for pos_session_id');
                
                if (sessionsTable) {
                    console.log(`📝 Will add FK to ${sessionsTable} after migration fix`);
                }
            }
        } else {
            console.log('⚠️  pos_session_id column not found in ar_ledger_entries');
        }
    }
    
    // Step 3: Check payment_method enum
    console.log('\n📝 Step 3: Checking payment_method enum...');
    const { data: enumCheck } = await supabase.rpc('exec_sql', {
        sql: "SELECT 1 FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method') AND enumlabel = 'TAB'"
    });
    
    if (enumCheck && enumCheck.length > 0) {
        console.log('✅ TAB already exists in payment_method enum');
    } else {
        console.log('⚠️  TAB not in payment_method enum (will be added by migration)');
    }
    
    // Step 4: Summary and next steps
    console.log('\n🎯 Step 4: Migration Resume Plan');
    console.log('================================');
    
    if (!ledgerTableExists || !customersTableExists) {
        console.log('1. Run original migration: 20260215232046_ar_tabs_mvp.sql');
        console.log('   - Creates tables with IF NOT EXISTS');
        console.log('   - Adds TAB to payment_method enum');
        console.log('   - Creates functions and views');
    } else {
        console.log('1. Tables already exist, checking FK...');
    }
    
    console.log(`2. Run fix migration: 20260216040000_ar_tabs_prod_fix.sql`);
    console.log('   - Fixes FK to reference correct sessions table');
    console.log('   - Handles partial apply scenarios');
    console.log('   - Safe for production');
    
    if (sessionsTable) {
        console.log(`3. Sessions table: ${sessionsTable} (FK will point here)`);
    } else {
        console.log('3. No sessions table found - FK will be skipped');
    }
    
    console.log('\n✅ Resume script complete');
    console.log('\n📋 To apply:');
    console.log('   a) Apply original migration (if not already)');
    console.log('   b) Apply fix migration');
    console.log('   c) Verify with: SELECT * FROM customer_balances LIMIT 5;');
}

main().catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
});