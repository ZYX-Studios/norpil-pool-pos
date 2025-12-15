"use client";

import React from "react";
import { ReportData } from "../../../admin/reports/data";
import { formatCurrency, formatPercent } from "../../../admin/reports/format";
import {
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Legend
} from "recharts";

interface RevenueAnalysisProps {
    data: ReportData;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function RevenueAnalysis({ data }: RevenueAnalysisProps) {
    const byCategory = data.byCategory ?? [];
    const byShift = data.byShift ?? [];
    const drinkMargins = data.drinkMargins ?? [];

    // Prepare Category Data
    const categoryData = byCategory.map((c: any) => ({
        name: c.category,
        value: Number(c.revenue),
    }));

    // Prepare Shift Data
    const shiftData = byShift.map((s: any) => ({
        name: s.shift_name,
        revenue: Number(s.revenue),
    }));

    // Prepare Drink Data (Alcoholic vs Non-Alcoholic)
    const drinkData = (drinkMargins ?? []).map((d: any) => ({
        name: d.is_alcoholic ? "Alcoholic" : "Non-Alcoholic",
        revenue: Number(d.revenue),
    }));

    // Prepare Payment Data (Exclude Deposits)
    const paymentData = (data.byMethod ?? [])
        .filter((m: any) => m.method !== 'WALLET_TOPUP')
        .map((m: any) => ({
            name: m.method === 'WALLET' ? 'Wallet' : m.method,
            value: Number(m.revenue)
        }));

    return (
        <div className="print-page">
            <h2 className="text-2xl font-bold mb-8 border-b border-neutral-200 pb-4 text-neutral-800">
                Revenue Analysis
            </h2>

            <div className="grid grid-cols-2 gap-8">
                {/* Category Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">Revenue by Category</h3>
                    <div className="h-64">
                        <div className="flex justify-center items-center">
                            <PieChart width={350} height={280}>
                                <Pie
                                    data={categoryData}
                                    cx={175}
                                    cy={140}
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={categoryData.length > 1 ? 3 : 0}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {categoryData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </PieChart>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {categoryData.map((cat, idx) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-neutral-600">{cat.name}</span>
                                <span className="font-medium">{formatCurrency(cat.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Shift Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">Shift Performance</h3>
                    <div className="h-64">
                        <div className="flex justify-center">
                            <BarChart width={300} height={250} data={shiftData} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 12 }} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="revenue" fill="#8b5cf6" radius={[0, 4, 4, 0]} barSize={30} isAnimationActive={false} />
                            </BarChart>
                        </div>
                    </div>
                </div>

                {/* Drink Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">Beverage Analysis</h3>
                    <div className="h-64">
                        <div className="flex justify-center">
                            <BarChart width={300} height={250} data={drinkData}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                                <YAxis tickFormatter={(val) => `₱${val}`} width={60} tick={{ fontSize: 10 }} />
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                                <Bar dataKey="revenue" fill="#ec4899" radius={[4, 4, 0, 0]} barSize={40} isAnimationActive={false} />
                            </BarChart>
                        </div>
                    </div>
                </div>

                {/* Payment Breakdown */}
                <div className="bg-white border border-neutral-200 rounded-lg p-6">
                    <h3 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-6">Revenue by Payment Method</h3>
                    <div className="h-64">
                        <div className="flex justify-center items-center">
                            <PieChart width={350} height={280}>
                                <Pie
                                    data={paymentData}
                                    cx={175}
                                    cy={140}
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                    isAnimationActive={false}
                                >
                                    {paymentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                            </PieChart>
                        </div>
                    </div>
                    <div className="mt-4 space-y-2">
                        {paymentData.map((m: any, idx: number) => (
                            <div key={idx} className="flex justify-between text-sm">
                                <span className="text-neutral-600">{m.name}</span>
                                <span className="font-medium">{formatCurrency(Number(m.value))}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
