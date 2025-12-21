const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wafmycddsldscayemwpp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZm15Y2Rkc2xkc2NheWVtd3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDE2MjUsImV4cCI6MjA3OTAxNzYyNX0.bYHH09z4CWBCQow-b5CQVvTebrnYE7kO34SCDTulEAo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchOrders() {
    console.log("Fetching orders with FIXED query...");
    const { data, error } = await supabase
        .from("orders")
        .select(`
            *,
            profiles(full_name),
            table_session:table_sessions(
                customer_name,
                pool_table:pool_tables!table_sessions_pool_table_id_fkey(name)
            ),
            order_items(
                id,
                quantity,
                served_quantity,
                product:products(name, category)
            )
        `)
        .or("status.in.(SUBMITTED,PREPARING,READY,PAID),and(status.eq.OPEN,order_type.eq.MOBILE)")
        .order("sent_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Error fetching kitchen orders (should be fixed):", error);
        return;
    }

    console.log(`SUCCESS! Fetched ${data.length} orders.`);

    // Quick validation of the first item
    if (data.length > 0) {
        const first = data[0];
        console.log("First Order ID:", first.id);
        console.log("Table Name (via correct FK):", first.table_session?.pool_table?.name);
    }
}

fetchOrders();
