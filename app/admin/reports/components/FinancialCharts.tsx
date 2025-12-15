"use client";

import { useMemo } from 'react';
import { Card } from '@/app/components/ui/Card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../format';

interface FinancialChartsProps {
    data: {
        sales: number;
        cashCollected: number;
        breakdown: {
            cash: number;
            gcash: number;
            other: number;
            deposits: number;
        };
        categories: {
            pool: number;
            food: number;
            drinks: number;
            other: number;
        };
    } | null;
}

const COLORS = {
    pool: '#3b82f6',   // Blue
    food: '#f59e0b',   // Amber
    drinks: '#ec4899', // Pink
    tax: '#94a3b8',    // Slate (Tax)
    other: '#6b7280',  // Gray

    cash: '#10b981',   // Emerald
    gcash: '#3b82f6',  // Blue
    deposits: '#8b5cf6', // Violet
    card: '#f43f5e'    // Rose
};

export function FinancialCharts({ data }: FinancialChartsProps) {
    if (!data) return null;

    // 1. Revenue Mix Data
    const revenueData = useMemo(() => {
        const knownTotal =
            (data.categories.pool || 0) +
            (data.categories.food || 0) +
            (data.categories.drinks || 0);

        // Calculate discrepancy (Tax/VAT)
        const discrepancy = Math.max(0, data.sales - knownTotal - (data.categories.other || 0));
        const finalOther = (data.categories.other || 0);

        return [
            { name: 'Pool', value: data.categories.pool, color: COLORS.pool },
            { name: 'Food', value: data.categories.food, color: COLORS.food },
            { name: 'Drinks', value: data.categories.drinks, color: COLORS.drinks },
            { name: 'Tax (VAT)', value: discrepancy, color: COLORS.tax },
            { name: 'Other', value: finalOther, color: COLORS.other },
        ].filter(d => d.value > 0);
    }, [data]);

    // 2. Payment Mix Data (Cash Flow)
    const paymentData = useMemo(() => {
        return [
            { name: 'Cash Sales', value: data.breakdown.cash, color: COLORS.cash },
            { name: 'Gcash Sales', value: data.breakdown.gcash, color: COLORS.gcash },
            { name: 'Wallet Deposits', value: data.breakdown.deposits, color: COLORS.deposits },
            { name: 'Other', value: data.breakdown.other, color: COLORS.card },
        ].filter(d => d.value > 0);
    }, [data]);

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Revenue Mix Chart */}
            <Card className="p-6 bg-neutral-900 border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6 text-center">
                    Revenue Mix
                </h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={revenueData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {revenueData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
                                itemStyle={{ color: '#e5e5e5' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value, entry: any) => (
                                    <span className="text-xs font-medium text-neutral-300 ml-1">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            {/* Payment Source Chart */}
            <Card className="p-6 bg-neutral-900 border-neutral-800">
                <h3 className="text-sm font-bold uppercase tracking-widest text-neutral-400 mb-6 text-center">
                    Cash Flow Sources
                </h3>
                <div className="h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={paymentData}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={80}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {paymentData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{ backgroundColor: '#171717', border: '1px solid #262626', borderRadius: '8px' }}
                                itemStyle={{ color: '#e5e5e5' }}
                            />
                            <Legend
                                verticalAlign="bottom"
                                height={36}
                                iconType="circle"
                                formatter={(value, entry: any) => (
                                    <span className="text-xs font-medium text-neutral-300 ml-1">{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Card>
        </div>
    );
}
