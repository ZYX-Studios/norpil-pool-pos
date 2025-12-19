const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    console.log("Fetching orders with total = 0 to repair...");

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id')
        .eq('total', 0);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log(`Found ${orders.length} orders to repair.`);

    for (const order of orders) {
        await repairOrder(order.id);
    }

    console.log("Repair complete.");
}

async function repairOrder(orderId) {
    // 1. Fetch Items
    const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("quantity, unit_price, line_total, products(category, tax_rate)")
        .eq("order_id", orderId);

    if (itemsErr) {
        console.error(`[${orderId}] Failed to fetch items:`, itemsErr);
        return;
    }

    if (!items || items.length === 0) {
        console.log(`[${orderId}] No items. Skipping.`);
        return;
    }

    let subtotal = 0;
    let taxTotal = 0;

    for (const row of items) {
        // Same exclusion logic as app
        const isTableTime = row.products?.category === "TABLE_TIME";

        // WARN: app logic says "exclude while OPEN". 
        // But if we are repairing, we should check status? 
        // Actually, if order is PAID/SERVED, we should include Table Time.
        // Let's verify status.

        // For simplicity, let's just sum all. 
        // The app logic "exclude while OPEN" is confusing. 
        // If it's Table Time, it should be in Total if it's in the bill.
        // The logic `if (isTableTime) continue` in `recalcOrderTotals` seems to imply Table Time is dynamic/virtual until closed?
        // But `releaseTable` INSERTS it. Once inserted, it should be counted!

        // Accessing DB directly:
        // If Table Time exists in order_items, it should be counted.
        // The only reason to exclude is if it's a *preview* calculation.
        // But `order_items` table contains *committed* items.

        // I will INCLUDE everything.

        const line = Number(row.line_total ?? 0);
        const taxRate = Number(row.products?.tax_rate ?? 0); // Default to 0 if product missing? Or 0.12?

        subtotal += line;
        taxTotal += Number((line * taxRate).toFixed(2));
    }

    const total = Number((subtotal + taxTotal).toFixed(2));

    if (total > 0) {
        console.log(`[${orderId}] Updating Total: ${total}`);
        const { error: updErr } = await supabase
            .from("orders")
            .update({ subtotal, tax_total: taxTotal, total })
            .eq("id", orderId);

        if (updErr) console.error(`[${orderId}] Update failed:`, updErr);
    } else {
        console.log(`[${orderId}] Calculated 0. Skipping.`);
    }
}

main();
