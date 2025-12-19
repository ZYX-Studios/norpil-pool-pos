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
    console.log("Fetching orders with total = 0...");

    const { data: orders, error } = await supabase
        .from('orders')
        .select(`
            id,
            status,
            total,
            created_at,
            order_type,
            table_session_id,
            order_items (count)
        `)
        .eq('total', 0)
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log(`Found ${orders.length} orders with 0 total (showing top 20 new ones):`);
    orders.forEach(o => {
        const itemCount = o.order_items ? o.order_items[0].count : 0;
        console.log(`- [${o.status}] ID: ${o.id.slice(0, 8)} | Type: ${o.order_type || 'POS'} | Session: ${o.table_session_id ? 'Yes' : 'No'} | Items: ${itemCount} | Created: ${new Date(o.created_at).toLocaleString()}`);
    });
}

main();
