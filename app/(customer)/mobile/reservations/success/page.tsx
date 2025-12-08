import Link from "next/link";
import { CheckCircle } from "lucide-react";
import { Button } from "@/app/components/ui/Button";

export default function ReservationSuccessPage() {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 text-center">
            <div className="bg-green-500/10 p-6 rounded-full mb-6">
                <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Reservation Confirmed!</h1>
            <p className="text-zinc-400 mb-8 max-w-md">
                Your table has been successfully reserved. The amount has been deducted from your wallet.
            </p>

            <div className="flex gap-4">
                <Link href="/reservations">
                    <Button variant="outline" className="border-zinc-700 text-zinc-300">
                        Make Another Booking
                    </Button>
                </Link>
                <Link href="/mobile/profile">
                    <Button className="bg-amber-600 hover:bg-amber-700 text-white border-none">
                        View My Reservations
                    </Button>
                </Link>
            </div>
        </div>
    );
}
