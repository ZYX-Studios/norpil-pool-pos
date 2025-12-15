"use client";

import { useMemo } from 'react';
import { Card } from '@/app/components/ui/Card';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { formatCurrency } from '../format';

interface DailyTrendChartProps {
    dailyData: any[];
}

export function DailyTrendChart({ dailyData }: DailyTrendChartProps) {
    const formattedData = useMemo(() => {
        return (dailyData ?? []).map((row: any) => ({
            day: new Date(row.day).getDate(), // Just the day number (1-31)
            fullDate: new Date(row.day).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
            revenue: Number(row.revenue ?? 0),
            isWeekend: [0, 6].includes(new Date(row.day).getDay())
        }));
    }, [dailyData]);

    if (!formattedData || formattedData.length === 0) return null;

    return (
        <Card className="col-span-1 md:col-span-2">
            <div className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-neutral-400">
                Daily Revenue Trend
            </div>
            <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={formattedData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                        <XAxis
                            dataKey="day"
                            stroke="#525252"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#525252"
                            fontSize={10}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(val) => `${val / 1000}k`}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: "#000000",
                                borderColor: "#333333",
                                color: "#ffffff",
                                fontSize: "12px",
                                borderRadius: "4px"
                            }}
                            cursor={{ fill: "rgba(255,255,255,0.05)" }}
                            formatter={(value: number) => [formatCurrency(value), "Revenue"]}
                            labelFormatter={(label, payload) => {
                                if (payload && payload.length > 0) {
                                    return payload[0].payload.fullDate;
                                }
                                return label;
                            }}
                        />
                        <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} opacity={0.9} />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}
