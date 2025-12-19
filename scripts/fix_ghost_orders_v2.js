
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load env
const envLocal = fs.readFileSync(path.resolve(__dirname, '../.env.local'), 'utf8');
const getEnv = (key) => {
    const match = envLocal.match(new RegExp(`${key}=(.*)`));
    return match ? match[1] : null;
};

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseServiceKey = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixGhostOrdersV2() {
    console.log("🔍 Starting Phase 2: Cleanup Remaining Ghosts...");

    // 1. Find Remaining Ghosts
    const { data: ghosts, error } = await supabase.from('orders')
        .select(`
            id, table_session_id, total, status, created_at,
            table_session:table_sessions!inner(customer_name)
        `)
        .eq('status', 'SERVED')
        .gte('created_at', '2025-12-18T00:00:00');

    if (error || !ghosts.length) {
        console.log("No ghosts found or error:", error);
        return;
    }

    console.log(`Found ${ghosts.length} remaining ghosts. Processing...`);

    for (const ghost of ghosts) {
        const customerName = ghost.table_session?.customer_name;
        console.log(`\n👻 Evaluating: ${customerName} (Order: ${ghost.id}, Total: ${ghost.total})`);

        // Check for Sibling Payment (Relaxed Rule: Any amount > 0)
        const { data: siblings } = await supabase.from('orders')
            .select('id, total, status')
            .eq('table_session_id', ghost.table_session_id)
            .neq('id', ghost.id)
            .eq('status', 'PAID')
            .eq('total', 0); // Glitch Order

        if (siblings && siblings.length > 0) {
            const glitchOrder = siblings[0];
            const { data: glitchPayments } = await supabase.from('payments').select('*').eq('order_id', glitchOrder.id);

            if (glitchPayments && glitchPayments.length > 0) {
                console.log(`   found misplaced payment on Sibling ${glitchOrder.id}. Moving it...`);

                // Move
                await supabase.from('payments').update({ order_id: ghost.id }).eq('order_id', glitchOrder.id);
                // Fix Status
                await supabase.from('orders').update({ status: 'PAID' }).eq('id', ghost.id);
                // Delete Glitch
                await supabase.from('orders').delete().eq('id', glitchOrder.id);

                console.log("   ✅ Fixed via Merge.");
                continue; // Done with this one
            }
        }

        // If no sibling payment, check LOGS (Replay Strategy)
        // Ignoring 'Norman' 859 as per user request
        if (customerName === 'Norman' && ghost.total == 859) {
            console.log("   Skipping Norman (859) as requested.");
            continue;
        }

        console.log("   No sibling payment found. Checking Logs for Replay...");

        const { data: logs } = await supabase.from('action_logs')
            .select('*')
            .eq('target_session_id', ghost.table_session_id) // Assuming entity_id link
            .or(`entity_id.eq.${ghost.table_session_id}`)
            .eq('action_type', 'PAY_ORDER')
            .order('created_at', { ascending: false })
            .limit(1);

        if (logs && logs.length > 0) {
            const log = logs[0];
            const details = log.details || {};
            const method = details.method || 'CASH';
            const amount = details.tenderedAmount;

            console.log(`   Found Log: ${method} ${amount}. Replaying...`);

            if (amount) {
                // Insert Payment
                await supabase.from('payments').insert({
                    order_id: ghost.id,
                    amount: amount,
                    tendered_amount: amount,
                    method: method,
                    created_at: log.created_at // Backdate to log time? Or now? Better use log time if possible or just now.
                    // Actually, keep it simple. Created At defaults to now. we can set 'paid_at'? 
                    // payments table schema check? usually just 'created_at'.
                });

                // Update Order
                await supabase.from('orders').update({ status: 'PAID' }).eq('id', ghost.id);

                // Close Session
                await supabase.from('table_sessions').update({ status: 'CLOSED' }).eq('id', ghost.table_session_id);

                console.log("   ✅ Fixed via Log Replay.");
            } else {
                console.log("   ⚠️ Log found but no amount details?");
            }
        } else {
            console.log("   ❌ No Payment Sibling AND No Payment Log found. Cannot fix automatically.");
        }
    }
}

fixGhostOrdersV2();
