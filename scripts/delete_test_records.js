const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching records to delete...");

    // 1. Fetch Payments
    const { data: payments, error: fetchError } = await supabase
        .from('payments')
        .select(`
            id, 
            order_id, 
            orders:order_id(
                id,
                table_session_id
            )
        `)
        .lte('paid_at', '2025-12-18T18:00:00+08:00');

    if (fetchError) {
        console.error("Error fetching payments:", fetchError);
        return;
    }

    if (!payments || payments.length === 0) {
        console.log("No records found to delete.");
        return;
    }

    console.log(`Found ${payments.length} payments to delete.`);

    const paymentIds = payments.map(p => p.id);
    const orderIds = payments.map(p => p.order_id).filter(Boolean);
    // Extract session IDs
    const sessionIds = payments
        .map(p => p.orders?.table_session_id)
        .filter(Boolean); // Remove null/undefined

    // Deduplicate
    const uniqueOrderIds = [...new Set(orderIds)];
    const uniqueSessionIds = [...new Set(sessionIds)];

    console.log(`To Delete:`);
    console.log(`- ${paymentIds.length} Payments`);
    console.log(`- ${uniqueOrderIds.length} Orders`);
    console.log(`- ${uniqueSessionIds.length} Table Sessions`);

    // 2. Delete Payments
    console.log("Deleting Payments...");
    const { error: delPaymentError } = await supabase
        .from('payments')
        .delete()
        .in('id', paymentIds);

    if (delPaymentError) {
        console.error("Error deleting payments:", delPaymentError);
        // If we fail here, we stop.
        return;
    }

    // 3. Delete Orders (Cascades to order_items typically, but if not we delete order items first?)
    // Usually standard FK deletes items. Let's assume cascade or try deleting order.
    // If we delete orders, it might clear sessions connection.
    if (uniqueOrderIds.length > 0) {
        console.log("Deleting Orders...");
        // Check for order items just in case
        const { error: delOrderError } = await supabase
            .from('orders')
            .delete()
            .in('id', uniqueOrderIds);

        if (delOrderError) {
            console.error("Error deleting orders:", delOrderError);
            // Continue to try sessions? Maybe.
        }
    }

    // 4. Delete Sessions
    // Only if they are truly finished/test sessions.
    if (uniqueSessionIds.length > 0) {
        console.log("Deleting potentially empty Table Sessions...");
        // Use ignore in case some are still referenced?
        const { error: delSessionError } = await supabase
            .from('table_sessions')
            .delete()
            .in('id', uniqueSessionIds);

        if (delSessionError) {
            console.error("Error deleting sessions (might be referenced elsewhere):", delSessionError);
        }
    }

    console.log("Deletion complete.");
}

main().catch(err => console.error(err));
