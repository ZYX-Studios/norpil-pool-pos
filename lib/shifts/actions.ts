"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { logAction } from "@/lib/logger";

export type GlobalShiftState = {
    status: "LOCKED_BY_OTHER" | "ACTIVE_MY_SHIFT" | "NO_SHIFT";
    activeShift: {
        id: string;
        started_at: string;
        starting_cash: number;
        staff_name?: string;
        staff_id?: string;
    } | null;
    lockedBy?: {
        name: string;
        id: string;
    };
    lastShift: {
        id: string;
        ended_at: string;
        expected_cash: number;
        actual_cash: number;
        difference: number;
    } | null;
};

export async function getGlobalShiftState(): Promise<GlobalShiftState> {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return { status: "NO_SHIFT", activeShift: null, lastShift: null };
    }

    // 1. Check for ANY active shift (global lock)
    const { data: activeShifts } = await supabase
        .from("cashier_shifts")
        .select("id, started_at, starting_cash, created_by, staff:staff_id(name)")
        .is("ended_at", null)
        .limit(1);

    const active = activeShifts?.[0];

    if (active) {
        const isMe = active.created_by === user.id;

        // If it's not me, fetch the name of the person who locked it
        let lockerName = "Another Staff";
        if (!isMe) {
            const { data: staff } = await supabase
                .from("staff")
                .select("name")
                .eq("user_id", active.created_by)
                .single();
            if (staff) lockerName = staff.name;
        }

        return {
            status: isMe ? "ACTIVE_MY_SHIFT" : "LOCKED_BY_OTHER",
            activeShift: {
                id: active.id,
                started_at: active.started_at,
                starting_cash: active.starting_cash,
                staff_name: lockerName
            },
            lockedBy: isMe ? undefined : { name: lockerName, id: active.created_by },
            lastShift: null
        };
    }

    // 2. If no active shift, get MY last shift for reporting
    const { data: myShifts } = await supabase
        .from("cashier_shifts")
        .select("*")
        .eq("created_by", user.id)
        .order("started_at", { ascending: false })
        .limit(1);

    const last = myShifts?.[0];

    return {
        status: "NO_SHIFT",
        activeShift: null,
        lastShift: last ? {
            id: last.id,
            ended_at: last.ended_at!,
            expected_cash: last.expected_cash!,
            actual_cash: last.actual_cash!,
            difference: last.difference!,
        } : null
    };
}

export async function startShift(startingCash: number) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) throw new Error("Unauthorized");

    // Check if already active
    const current = await getGlobalShiftState();
    if (current.status !== "NO_SHIFT") {
        throw new Error("Shift already active or locked");
    }

    const { data, error } = await supabase.from("cashier_shifts").insert({
        starting_cash: startingCash,
        // created_by default handles user
    })
        .select()
        .single();

    if (error) throw error;

    await logAction({
        actionType: "START_SHIFT",
        entityType: "cashier_shifts",
        entityId: data.id,
        details: { startingCash },
    });

    revalidatePath("/", "layout"); // Revalidate broadly to update UI
}

export async function getExpectedCash(shiftId: string) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Get shift details
    const { data: shift, error: shiftErr } = await supabase
        .from("cashier_shifts")
        .select("*")
        .eq("id", shiftId)
        .single();

    if (shiftErr) throw shiftErr;
    if (shift.created_by !== user.id) throw new Error("Not your shift");

    // Clean timestamp for RPC
    // Postgres might need specific formatting, but timestamptz string usually works.
    const { data: paymentsTotal, error: rpcErr } = await supabase
        .rpc("get_shift_payments_total", {
            p_user_id: user.id,
            p_start: shift.started_at,
            p_end: new Date().toISOString()
        });

    if (rpcErr) throw rpcErr;

    const starting = Number(shift.starting_cash);
    const sales = Number(paymentsTotal);

    return {
        starting,
        sales,
        expected: starting + sales
    };
}

export async function endShift(shiftId: string, actualCash: number, notes: string) {
    const supabase = await createSupabaseServerClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");

    // Calculate expected one last time to be precise
    const stats = await getExpectedCash(shiftId);
    const difference = actualCash - stats.expected;

    const { error } = await supabase
        .from("cashier_shifts")
        .update({
            ended_at: new Date().toISOString(),
            expected_cash: stats.expected,
            actual_cash: actualCash,
            difference: difference,
            notes: notes
        })
        .eq("id", shiftId);

    if (error) throw error;

    await logAction({
        actionType: "END_SHIFT",
        entityType: "cashier_shifts",
        entityId: shiftId,
        details: {
            expected: stats.expected,
            actual: actualCash,
            difference,
            notes
        },
    });

    revalidatePath("/", "layout");
}
