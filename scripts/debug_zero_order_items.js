const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const orderId = '204acdb7-24a7-47d3-9bc0-d66838a54d5b'; // Using full UUID if possible, but I only have prefix. Let's search by prefix.

    // First find full ID
    const { data: order } = await supabase.from('orders').select('id, total').like('id', '204acdb7%').single();

    if (!order) {
        console.log("Order not found with prefix 204acdb7");
        return;
    }

    console.log(`Inspecting Order: ${order.id} | Total: ${order.total}`);

    const { data: items } = await supabase
        .from('order_items')
        .select(`
            id,
            quantity,
            unit_price,
            line_total,
            products (name, price, category)
        `)
        .eq('order_id', order.id);

    console.log("Items:", JSON.stringify(items, null, 2));
}

main();
