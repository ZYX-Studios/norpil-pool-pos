"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useEffect, useState } from "react";
import { format, differenceInHours, parseISO } from "date-fns";
import { Calendar, Clock, MapPin, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/Button";
import { Modal } from "@/app/components/ui/Modal";

export function ReservationsList({ userId }: { userId: string }) {
    const [reservations, setReservations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [cancelId, setCancelId] = useState<string | null>(null);
    const supabase = createSupabaseBrowserClient();

    useEffect(() => {
        fetchReservations();
    }, [userId]);

    const fetchReservations = async () => {
        const { data } = await supabase
            .from("reservations")
            .select("*, pool_tables(name)")
            .eq("profile_id", userId)
            .order("start_time", { ascending: false });

        if (data) setReservations(data);
        setLoading(false);
    };

    const handleCancel = async () => {
        if (!cancelId) return;

        // Find the reservation to get start time for quick check
        const resToCheck = reservations.find(r => r.id === cancelId);
        if (resToCheck) {
            const start = parseISO(resToCheck.start_time);
            const now = new Date();
            if (differenceInHours(start, now) < 24) {
                alert("Uncancellable. Reservations must be cancelled 24h in advance.");
                setCancelId(null);
                return;
            }
        }

        try {
            const response = await fetch('/api/reservations/cancel', {
                method: 'POST',
                body: JSON.stringify({ id: cancelId })
            });
            const result = await response.json();

            if (result.success) {
                alert("Reservation cancelled and refunded.");
                fetchReservations();
            } else {
                alert(result.message || "Failed to cancel");
            }
        } catch (e) {
            alert("An error occurred");
        } finally {
            setCancelId(null);
        }
    };

    if (loading) return <div className="text-white/50">Loading reservations...</div>;
    if (reservations.length === 0) return <div className="text-white/50 bg-white/5 p-4 rounded-xl border border-white/10 text-center">No reservations found.</div>;

    return (
        <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">My Reservations</h3>
            <div className="space-y-3">
                {reservations.map((res) => {
                    const start = parseISO(res.start_time);
                    const canCancel = differenceInHours(start, new Date()) >= 24 && res.status !== 'CANCELLED';

                    return (
                        <div key={res.id} className="bg-zinc-900/50 border border-white/10 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div>
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${res.status === 'CONFIRMED' ? 'bg-emerald-500/20 text-emerald-400' :
                                            res.status === 'CANCELLED' ? 'bg-red-500/20 text-red-400' :
                                                'bg-zinc-700 text-zinc-300'
                                        }`}>
                                        {res.status}
                                    </span>
                                    <span className="text-white font-medium">{res.pool_tables?.name || "Unknown Table"}</span>
                                </div>
                                <div className="text-sm text-zinc-400 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-3 h-3" />
                                        {format(start, "PPP")}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-3 h-3" />
                                        {format(start, "p")} - {format(parseISO(res.end_time), "p")}
                                    </div>
                                </div>
                            </div>

                            {canCancel && res.status === 'CONFIRMED' && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-300 hover:bg-red-950/50 self-end sm:self-center"
                                    onClick={() => setCancelId(res.id)}
                                >
                                    <Trash2 className="w-4 h-4 mr-2" /> Cancel
                                </Button>
                            )}
                        </div>
                    );
                })}
            </div>

            <Modal
                isOpen={!!cancelId}
                onClose={() => setCancelId(null)}
                title="Cancel Reservation?"
                description="This will cancel your booking and refund the amount to your wallet. Use with caution."
                footer={
                    <>
                        <Button variant="ghost" onClick={() => setCancelId(null)}>Keep it</Button>
                        <Button variant="destructive" onClick={handleCancel}>Yes, Cancel</Button>
                    </>
                }
            >
                <p className="text-sm text-neutral-300">Are you sure you want to proceed?</p>
            </Modal>
        </div>
    );
}
