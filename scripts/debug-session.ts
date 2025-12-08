
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function main() {
    const { data: reservations, error } = await supabase
        .from("reservations")
        .select("id, start_time, pool_table_id, status, profile_id")
        .in('status', ['CONFIRMED', 'PENDING'])
        .order('start_time', { ascending: true })
        .limit(5);

    if (error) {
        console.error("Error fetching reservations:", error);
        return;
    }

    console.log("Reservations:", JSON.stringify(reservations, null, 2));
}

main();
