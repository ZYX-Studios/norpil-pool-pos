import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { differenceInHours, parseISO } from "date-fns";

export async function POST(request: Request) {
    const supabase = await createClient();
    const { id } = await request.json();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    // Fetch reservation
    const { data: reservation, error } = await supabase
        .from("reservations")
        .select("*, pool_tables(hourly_rate)")
        .eq("id", id)
        .single();

    if (error || !reservation) {
        return NextResponse.json({ success: false, message: "Reservation not found" }, { status: 404 });
    }

    // Check ownership
    if (reservation.profile_id !== user.id) {
        return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    // Check time policy (24 hours)
    const startTime = parseISO(reservation.start_time);
    const hoursDiff = differenceInHours(startTime, new Date());

    if (hoursDiff < 24) {
        return NextResponse.json({ success: false, message: "Too late to cancel. Must be 24h in advance." }, { status: 400 });
    }

    if (reservation.status === 'CANCELLED') {
        return NextResponse.json({ success: false, message: "Already cancelled" }, { status: 400 });
    }

    // Perform Cancellation & Refund Transaction
    // We need to do this atomically. 
    // Since we don't have a specific `cancel_reservation` RPC, we'll do it in steps here, 
    // but ideally we should wrap this in an RPC or use RLS that allows these specific updates.
    // Given we are on the server (API route), we can use the service role key if needed, 
    // but `createClient` uses user auth.
    // User policies allow:
    // - Viewing own reservations.
    // - Creating (INSERT).
    // - They might NOT have UPDATE permission on status or wallet balance directly.

    // Checking policies again:
    // "Staff can update reservations", "Users can view own".
    // Users do NOT have UPDATE permission on `reservations`.
    // So a user CANNOT update status to 'CANCELLED' directly via client or standard client-auth server.
    // We MUST use a Service Role client or an RPC.

    // I'll create a quick `cancel_reservation_refund` RPC.
    // This is safer and cleaner.

    // For now, I will write this API route to assume an RPC `cancel_reservation_with_refund` exists, 
    // and I will go create it in the next step.

    const { data: result, error: rpcError } = await supabase.rpc('cancel_reservation_with_refund', {
        p_reservation_id: id,
        p_user_id: user.id
    });

    if (rpcError) {
        console.error("RPC Error", rpcError);
        return NextResponse.json({ success: false, message: rpcError.message }, { status: 500 });
    }

    if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Cancelled and refunded" });
}
