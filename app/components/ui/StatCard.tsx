import { Card } from "./Card";
import { cn } from "@/lib/utils";

interface StatCardProps {
    label: string;
    value: string | number;
    subValue?: string;
    trend?: number; // percentage change (e.g. 15.5 for +15.5%)
    trendLabel?: string; // context (e.g. "vs last week")
    className?: string;
}

export function StatCard({ label, value, subValue, trend, trendLabel, className }: StatCardProps) {
    const isPositive = (trend || 0) >= 0;
    const isNeutral = trend === undefined || trend === 0;

    return (
        <Card className={cn("flex flex-col justify-between", className)}>
            <div className="text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
                {label}
            </div>
            <div className="mt-2">
                <div className="text-3xl font-semibold text-neutral-50">{value}</div>

                <div className="flex items-center gap-2 mt-1">
                    {trend !== undefined && (
                        <div className={cn(
                            "text-sm font-medium flex items-center",
                            isPositive ? "text-emerald-400" : "text-rose-400",
                            isNeutral && "text-neutral-500"
                        )}>
                            {isPositive ? "↑" : "↓"} {Math.abs(trend).toFixed(1)}%
                        </div>
                    )}
                    {trendLabel && <div className="text-sm text-neutral-500">{trendLabel}</div>}
                    {subValue && !trend && <div className="text-sm text-neutral-500">{subValue}</div>}
                </div>
            </div>
        </Card>
    );
}
