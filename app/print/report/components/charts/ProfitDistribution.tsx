import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface ProfitDistributionProps {
    salesData: {
        table: number;
        food: number;
        beverage: number;
        merch: number;
        other: number;
    };
    expensesData: {
        category: string;
        amount: number;
    }[];
    startDate: string;
    endDate: string;
}

export function ProfitDistribution({ salesData, expensesData, startDate, endDate }: ProfitDistributionProps) {
    const totalSales = salesData.table + salesData.food + salesData.beverage + salesData.merch + salesData.other;
    const totalExpenses = expensesData.reduce((sum, item) => sum + item.amount, 0);
    const netProfit = totalSales - totalExpenses;

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const dateRange = `${formatDate(startDate)} to ${formatDate(endDate)}`;

    // Placeholder for Pie Chart Data (Dividend)
    // In a real scenario, this would come from a `partners` table configuration
    const mockPartners = [
        { name: 'Partner A', value: netProfit * 0.4 },
        { name: 'Partner B', value: netProfit * 0.3 },
        { name: 'Partner C', value: netProfit * 0.3 },
    ];

    const COLORS = ['#1e40af', '#0d9488', '#d97706', '#64748b'];

    return (
        <div className="w-full space-y-8">
            <div className="flex gap-8">
                {/* Left Column: Sales Coverage */}
                <div className="flex-1">
                    <table className="w-full text-sm border-collapse border-b border-neutral-300">
                        <thead className="bg-black text-white">
                            <tr>
                                <th colSpan={2} className="p-2 text-center font-bold uppercase tracking-wider text-xs">
                                    Sales Coverage (Source)
                                </th>
                            </tr>
                            <tr className="bg-neutral-100 text-black border-b border-neutral-300">
                                <th className="p-2 text-left w-1/2 font-bold">Category</th>
                                <th className="p-2 text-right font-bold">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            <tr>
                                <td className="p-2 font-medium">Table Sales</td>
                                <td className="p-2 text-right font-mono">{salesData.table.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-medium">Food Sales</td>
                                <td className="p-2 text-right font-mono">{salesData.food.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-medium">Beverage Sales</td>
                                <td className="p-2 text-right font-mono">{salesData.beverage.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr>
                                <td className="p-2 font-medium">Collectibles/Other</td>
                                <td className="p-2 text-right font-mono">{(salesData.merch + salesData.other).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                            <tr className="bg-neutral-100 font-bold border-t-2 border-black">
                                <td className="p-2 uppercase text-xs">Total Sales</td>
                                <td className="p-2 text-right font-mono text-blue-600">{totalSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Dividend Pie Chart */}
                    <div className="mt-8 border border-neutral-200 p-4 rounded-lg bg-neutral-50 mb-0">
                        <div className="text-center font-bold mb-4 text-black uppercase tracking-wide text-sm border-b border-neutral-200 pb-2">Profit Distribution</div>
                        <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={mockPartners}
                                        cx="50%"
                                        cy="50%"
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                        label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        isAnimationActive={false}
                                    >
                                        {mockPartners.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(val: number) => val.toLocaleString(undefined, { minimumFractionDigits: 2 })} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>

                {/* Right Column: Expenses Coverage */}
                <div className="flex-1">
                    <table className="w-full text-sm border-collapse border-b border-neutral-300">
                        <thead className="bg-black text-white">
                            <tr>
                                <th colSpan={2} className="p-2 text-center font-bold uppercase tracking-wider text-xs">
                                    Expenses Coverage (Deductions)
                                </th>
                            </tr>
                            <tr className="bg-neutral-100 text-black border-b border-neutral-300">
                                <th className="p-2 text-left w-1/2 font-bold">Category</th>
                                <th className="p-2 text-right font-bold">Amount</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-neutral-200">
                            {expensesData.map((exp, index) => (
                                <tr key={index}>
                                    <td className="p-2 font-medium">{exp.category}</td>
                                    <td className="p-2 text-right font-mono">{exp.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                </tr>
                            ))}
                            {/* Fill for visual balance */}
                            {expensesData.length < 5 && Array.from({ length: 5 - expensesData.length }).map((_, i) => (
                                <tr key={`empty-${i}`}>
                                    <td className="p-2 text-neutral-300">Open Slot</td>
                                    <td className="p-2 text-right text-neutral-300">-</td>
                                </tr>
                            ))}

                            <tr className="bg-neutral-100 font-bold border-t-2 border-black">
                                <td className="p-2 uppercase text-xs">Total Expenses</td>
                                <td className="p-2 text-right font-mono text-red-600">{totalExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
