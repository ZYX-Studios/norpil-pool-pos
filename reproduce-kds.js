const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://wafmycddsldscayemwpp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndhZm15Y2Rkc2xkc2NheWVtd3BwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM0NDE2MjUsImV4cCI6MjA3OTAxNzYyNX0.bYHH09z4CWBCQow-b5CQVvTebrnYE7kO34SCDTulEAo';

const supabase = createClient(supabaseUrl, supabaseKey);

async function fetchOrders() {
    console.log("Fetching orders...");
    const { data, error } = await supabase
        .from("orders")
        .select(`
            *,
            profiles(full_name),
            table_session:table_sessions(
                customer_name,
                pool_table:pool_tables(name)
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
        console.error("Error fetching kitchen orders:", error);
        return;
    }

    console.log(`Fetched ${data.length} orders directly from API.`);

    const filteredData = data.map((order) => {
        const originalItemCount = order.order_items ? order.order_items.length : 0;

        const validItems = (order.order_items || [])
            .filter((item) => {
                const isTableTime = item.product?.category === 'TABLE_TIME';
                if (isTableTime) console.log(`Order ${order.id} has TABLE_TIME item, filtering out.`);
                return !isTableTime;
            })
            .map((item) => ({
                ...item,
                quantity: (item.quantity || 0) - (item.served_quantity || 0)
            }))
            .filter((item) => item.quantity > 0);

        return {
            ...order,
            order_items: validItems,
            _debug_original_items: originalItemCount
        };
    }).filter((order) => order.order_items.length > 0);

    console.log(`Filtered down to ${filteredData.length} visible orders.`);

    if (filteredData.length === 0 && data.length > 0) {
        console.log("All orders were filtered out! Debugging first one:");
        const first = data[0];
        console.log("First Order ID:", first.id);
        console.log("Order items:", JSON.stringify(first.order_items, null, 2));
    } else {
        console.log("First 3 Visible Orders:");
        console.log(JSON.stringify(filteredData.slice(0, 3).map(o => ({
            id: o.id,
            status: o.status,
            items: o.order_items.length,
            table: o.table_session?.pool_table?.name
        })), null, 2));
    }
}

fetchOrders();
