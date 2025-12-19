const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env.local') });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase URL or Key in .env.local");
    process.exit(1);
}

console.log(`Connecting to ${supabaseUrl}`);

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('payments')
        .select(`
            id, 
            amount, 
            method, 
            paid_at, 
            orders:order_id(
                id,
                total,
                status,
                table_sessions:table_session_id(customer_name)
            )
        `)
        .lte('paid_at', '2025-12-18T18:00:00+08:00')
        .order('paid_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Supabase Error:", JSON.stringify(error, null, 2));
    } else {
        console.log("Records Found:");
        console.log(JSON.stringify(data, null, 2));
    }
}

main().catch(err => console.error(err));
