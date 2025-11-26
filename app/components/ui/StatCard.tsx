import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    trend?: "up" | "down" | "neutral";
    className?: string;
}

export function StatCard({ label, value, subValue, trend, className }: StatCardProps) {
    return (
        <Card className={cn("flex flex-col justify-between", className)}>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
                {label}
            </div>
            <div className="mt-2">
                <div className="text-3xl font-semibold text-neutral-50">{value}</div>
                {subValue && <div className="text-sm text-neutral-500">{subValue}</div>}
            </div>
        </Card>
    );
}
