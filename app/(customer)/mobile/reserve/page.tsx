export default function ReservePage() {
    return (
        <div className="p-6 space-y-6 max-w-md mx-auto">
            <h1 className="text-2xl font-bold">Reserve a Table</h1>
            <p className="text-muted-foreground">Select a date and time to book your table.</p>

            <div className="bg-card border rounded-xl p-8 text-center space-y-4">
                <span className="text-4xl">🚧</span>
                <h3 className="font-semibold">Coming Soon</h3>
                <p className="text-sm text-muted-foreground">Online reservations will be available shortly. Please visit the counter to book.</p>
            </div>
        </div>
    );
}
