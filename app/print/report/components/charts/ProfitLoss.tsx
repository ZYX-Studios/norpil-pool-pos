import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

interface ProfitLossProps {
    totalRevenue: number;
    totalExpenses: number;
    previousRevenue?: number; // For comparison
    previousExpenses?: number; // For comparison
}

export function ProfitLoss({ totalRevenue, totalExpenses, previousRevenue = 0, previousExpenses = 0 }: ProfitLossProps) {
    const netProfit = totalRevenue - totalExpenses;
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    const data = [
        { name: 'Expenses', value: totalExpenses },
        { name: 'Net Profit', value: netProfit > 0 ? netProfit : 0 },
    ];

    const COLORS = ['#ef4444', '#0ea5e9']; // Red for expenses, Blue for profit (based on image)

    return (
        <div className="w-full space-y-12">

            {/* P&L Comparison Section */}
            <div className="break-inside-avoid">
                <div className="flex justify-between items-baseline border-b border-neutral-300 mb-8 pb-2">
                    <h3 className="text-xl font-bold text-neutral-900 uppercase tracking-wide">P&L Comparison</h3>
                    <div className="text-right">
                        <div className="text-sm text-neutral-500 uppercase">Net Profit Margin</div>
                        <div className={`text-3xl font-bold ${profitMargin >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {profitMargin.toFixed(1)}%
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-8 text-center mb-8">
                    {/* Sales Block */}
                    <div className="bg-neutral-50 p-4 rounded border border-neutral-200">
                        <div className="text-sm font-bold text-neutral-500 uppercase mb-1">Total Sales</div>
                        <div className="text-2xl font-bold text-neutral-800">{totalRevenue.toLocaleString()}</div>
                        {previousRevenue > 0 && (
                            <div className="text-xs text-neutral-400 mt-1">Prev: {previousRevenue.toLocaleString()}</div>
                        )}
                    </div>
                    {/* Expenses Block */}
                    <div className="bg-neutral-50 p-4 rounded border border-neutral-200">
                        <div className="text-sm font-bold text-neutral-500 uppercase mb-1">Total Expenses</div>
                        <div className="text-2xl font-bold text-red-600">{totalExpenses.toLocaleString()}</div>
                        {previousExpenses > 0 && (
                            <div className="text-xs text-neutral-400 mt-1">Prev: {previousExpenses.toLocaleString()}</div>
                        )}
                    </div>
                    {/* Profit Block */}
                    <div className="bg-neutral-50 p-4 rounded border border-neutral-200">
                        <div className="text-sm font-bold text-neutral-500 uppercase mb-1">Net Profit</div>
                        <div className={`text-2xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {netProfit.toLocaleString()}
                        </div>
                    </div>
                </div>

                {/* Pie Chart of Margin */}
                <div className="h-64 flex justify-center items-center">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={data}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={100}
                                fill="#8884d8"
                                paddingAngle={5}
                                dataKey="value"
                                isAnimationActive={false}
                            >
                                {data.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip formatter={(val: number) => val.toLocaleString()} />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>


        </div>
    );
}
