const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const orderId = '204acdb7-9c6b-4553-a664-43b2ec9ce1cf'; // The specific failed order

    console.log(`Simulating recalcOrderTotals for ${orderId}...`);

    const { data: items, error: itemsErr } = await supabase
        .from("order_items")
        .select("quantity, unit_price, line_total, products(category, tax_rate)")
        .eq("order_id", orderId);

    if (itemsErr) {
        console.error("Fetch Error:", itemsErr);
        return;
    }

    console.log(`Fetched ${items.length} items.`);

    let subtotal = 0;
    let taxTotal = 0;

    for (const row of items) {
        console.log("Item:", JSON.stringify(row));
        const isTableTime = row.products?.category === "TABLE_TIME";

        if (isTableTime) {
            console.log(" -> Skipping Table Time");
            continue;
        }

        const line = Number(row.line_total ?? 0);
        const taxRate = Number(row.products?.tax_rate ?? 0);

        console.log(` -> Adding line: ${line}, taxRate: ${taxRate}`);

        subtotal += line;
        taxTotal += Number((line * taxRate).toFixed(2));
    }

    const total = Number((subtotal + taxTotal).toFixed(2));
    console.log("--------------------------------");
    console.log(`Calculated Subtotal: ${subtotal}`);
    console.log(`Calculated Tax: ${taxTotal}`);
    console.log(`Calculated Total: ${total}`);
}

main();
