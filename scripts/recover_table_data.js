
const { createClient } = require('@supabase/supabase-js');

// Load environment variables (assumes .env.local availability or hardcoded for this one-off)
// Note: For this script to run easily in this environment, I'll ask the user to provide the URL/KEY or read it from process if running via tool.
// But since I'm running via `run_command` in the existing project, I can likely just import headers or use a simple hardcoded client if I had the keys.
// Use `process.env.NEXT_PUBLIC_SUPABASE_URL` and `process.env.SUPABASE_SERVICE_ROLE_KEY` if available.

// Since I cannot interactively ask for keys safely in a script file without complications, 
// I will assume I can read the .env.local file or the user context has it. 
// Actually, the safest way is to use the existing `lib/supabase/server` but that requires a Next.js context.
// Better plan: Create a standalone script `scripts/recover_table_data.ts` that uses `dotenv`.

require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Service Role Key in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function recoverTableData() {
    console.log("Starting data recovery...");

    // 1. Find broken sessions (Null pool_table_id AND Null released_from_table_id)
    // And also verify they were NOT "Walk-in" originally (check if we can infer that).
    // Actually, simpler: Look for any session that has an OPEN_TABLE log with a poolTableId.
    // If `released_from_table_id` is already set, skip it.

    // Fetch all OPEN_TABLE logs
    const { data: logs, error: logsErr } = await supabase
        .from('action_logs')
        .select('entity_id, details')
        .eq('action_type', 'OPEN_TABLE');

    if (logsErr) {
        console.error("Error fetching logs:", logsErr);
        return;
    }

    console.log(`Found ${logs.length} OPEN_TABLE logs.`);

    let updatedCount = 0;

    for (const log of logs) {
        const sessionId = log.entity_id;
        const poolTableId = log.details?.poolTableId;

        if (!poolTableId) continue;

        // Check current session state
        const { data: session, error: sessErr } = await supabase
            .from('table_sessions')
            .select('id, pool_table_id, released_from_table_id, location_name')
            .eq('id', sessionId)
            .single();

        if (sessErr) {
            // Session might be deleted or not found
            continue;
        }

        // Condition to fix:
        // 1. pool_table_id is NULL (it was released)
        // 2. released_from_table_id is NULL (it wasn't tracked)
        // 3. We have a poolTableId from logs.
        if (!session.pool_table_id && !session.released_from_table_id) {
            console.log(`Recovering Session ${sessionId} -> Table ${poolTableId}`);

            // Need to fetch table name for location_name repair
            const { data: table } = await supabase
                .from('pool_tables')
                .select('name')
                .eq('id', poolTableId)
                .single();

            const updates = {
                released_from_table_id: poolTableId
            };

            // Repair location_name if missing or "Walk-in" (if it was actually a table)
            if (!session.location_name || session.location_name === 'Walk-in') {
                if (table?.name) {
                    updates.location_name = table.name;
                }
            }

            const { error: updateErr } = await supabase
                .from('table_sessions')
                .update(updates)
                .eq('id', sessionId);

            if (updateErr) {
                console.error(`Failed to update session ${sessionId}:`, updateErr);
            } else {
                updatedCount++;
            }
        }
    }

    console.log(`Recovery Complete. Updated ${updatedCount} sessions.`);
}

recoverTableData();
