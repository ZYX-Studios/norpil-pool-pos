
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

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function fixGhostOrders() {
    console.log("🔍 Scanning for 'Ghost' Orders (Unpaid Served + Paid Empty Sibling)...");

    // 1. Find Candidates
    const { data: ghosts, error } = await supabase.from('orders')
        .select(`
            id, table_session_id, total, status, created_at,
            table_session:table_sessions!inner(customer_name)
        `)
        .eq('status', 'SERVED')
        // Filter by date range to be safe
        .gte('created_at', '2025-12-18T00:00:00')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching ghosts:", error);
        return;
    }

    console.log(`Found ${ghosts.length} SERVED orders since Dec 18. Checking for payments...`);

    let matchedCount = 0;

    for (const ghost of ghosts) {
        // Check if truly unpaid
        const { data: payments } = await supabase.from('payments').select('id').eq('order_id', ghost.id);
        if (payments && payments.length > 0) {
            continue; // Already paid, skip
        }

        // Look for Sibling with Payment
        const { data: siblings } = await supabase.from('orders')
            .select('id, total, status')
            .eq('table_session_id', ghost.table_session_id)
            .neq('id', ghost.id)
            .eq('status', 'PAID')
            .eq('total', 0); // The glitch empty order

        if (siblings && siblings.length > 0) {
            const glitchOrder = siblings[0]; // Assume first if multiple

            // Verify Glitch Order has Payment
            const { data: glitchPayments } = await supabase.from('payments')
                .select('*')
                .eq('order_id', glitchOrder.id);

            if (glitchPayments && glitchPayments.length > 0) {
                const totalPaid = glitchPayments.reduce((sum, p) => sum + p.amount, 0);

                console.log(`\n👻 GHOST FOUND: [${ghost.table_session?.customer_name}]`);
                console.log(`   Real Order: ${ghost.id} (Total: ${ghost.total}, Status: SERVED)`);
                console.log(`   Glitch Order: ${glitchOrder.id} (Total: 0, Status: PAID)`);
                console.log(`   Payments Found on Glitch: ${totalPaid}`);

                if (Math.abs(totalPaid - ghost.total) < 5 || totalPaid >= ghost.total) { // Allow small diff or overpay
                    console.log("   ✅ MATCH CONFIRMED. Moving payments...");

                    // 2. Move Payments
                    const { error: moveErr } = await supabase
                        .from('payments')
                        .update({ order_id: ghost.id })
                        .eq('order_id', glitchOrder.id);

                    if (moveErr) {
                        console.error("   ❌ Failed to move payments:", moveErr);
                        continue;
                    }

                    // 3. Mark Real Order PAID
                    const { error: updErr } = await supabase
                        .from('orders')
                        .update({ status: 'PAID' })
                        .eq('id', ghost.id);

                    if (updErr) {
                        console.error("   ❌ Failed to update real order status:", updErr);
                        continue;
                    }

                    // 4. Close Session if needed (it likely is closed, but good to ensure)
                    const { error: sessErr } = await supabase
                        .from('table_sessions')
                        .update({ status: 'CLOSED' })
                        .eq('id', ghost.table_session_id)
                        .eq('status', 'OPEN'); // Only if still open

                    if (!sessErr) {
                        // console.log("   Session closed.");
                    }

                    // 5. Delete Glitch Order
                    const { error: delErr } = await supabase
                        .from('orders')
                        .delete()
                        .eq('id', glitchOrder.id);

                    if (delErr) {
                        console.error("   ⚠️ Failed to delete glitch order (might have other links):", delErr);
                    } else {
                        console.log("   🗑️ Glitch order deleted.");
                    }

                    console.log("   🎉 FIXED.");
                    matchedCount++;
                } else {
                    console.log("   ⚠️ MISMATCH: Payment amount differs significantly. Skipping auto-fix.");
                }
            }
        }
    }

    console.log(`\n\nDone. Fixed ${matchedCount} orders.`);
}

fixGhostOrders();
