import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList, Cell } from "recharts";

interface DailyExpense {
    date: string;
    [category: string]: number | string; // dynamic categories
}

interface ExpenseCategory {
    category: string;
    amount: number;
}

interface ExpenseChartsProps {
    dailyData: DailyExpense[];
    monthlyData: ExpenseCategory[];
    startDate: string;
    endDate: string;
}

// Use a monochromatic Slate scale for expenses to look professional/serious, with Red for high attention
const COLORS = ['#ef4444', '#334155', '#475569', '#64748b', '#94a3b8', '#cbd5e1', '#000000', '#171717', '#404040', '#737373'];

export function DailyExpensesChart({ dailyData, height = 350 }: { dailyData: DailyExpense[]; height?: number }) {
    // Format Daily Data for Chart
    const formattedDaily = dailyData.map(d => {
        const day = new Date(d.date).getDate();
        return { ...d, day, total: Object.entries(d).reduce((acc, [k, v]) => k !== 'date' && k !== 'day' ? acc + Number(v) : acc, 0) };
    });

    const totalExpenses = formattedDaily.reduce((sum, d) => sum + d.total, 0);

    // Get all unique categories from daily data keys
    const allCategories = Array.from(new Set(dailyData.flatMap(d => Object.keys(d).filter(k => k !== 'date'))));

    return (
        <div className="w-full">
            <div className="flex justify-between items-baseline border-b border-neutral-300 mb-4 pb-2">
                <h3 className="text-xl font-bold text-black uppercase tracking-wide">Daily Expenses</h3>
                <div className="text-lg font-bold text-red-600">
                    Total: <span className="underline decoration-double text-xl">{totalExpenses.toLocaleString()}</span>
                </div>
            </div>

            <div style={{ width: "100%", height: height }}>
                <ResponsiveContainer>
                    <BarChart
                        data={formattedDaily}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#666' }} interval={0} />
                        <YAxis tick={{ fontSize: 10, fill: '#666' }} tickFormatter={(val) => val >= 1000 ? `${val / 1000}k` : val} />
                        <Tooltip formatter={(val: number) => val.toLocaleString()} labelFormatter={(l) => `Day ${l}`} />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />

                        {allCategories.map((cat, index) => (
                            <Bar key={cat} dataKey={cat} stackId="a" fill={COLORS[index % COLORS.length]} name={cat} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export function MonthlyExpensesChart({ monthlyData }: { monthlyData: ExpenseCategory[] }) {
    // Sort Monthly Data Descending
    const sortedMonthly = [...monthlyData].sort((a, b) => b.amount - a.amount);

    return (
        <div className="w-full">
            <div className="flex justify-between items-baseline border-b border-neutral-300 mb-4 pb-2">
                <h3 className="text-xl font-bold text-neutral-900 uppercase tracking-wide">Monthly Expenses Breakdown</h3>
            </div>

            {/* Dynamic height based on items to avoid huge gaps or scrolling */}
            <div style={{ width: "100%", height: Math.max(150, sortedMonthly.length * 60) }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedMonthly}
                        layout="vertical"
                        margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(val) => val >= 1000 ? `${val / 1000}k` : val} />
                        <YAxis
                            dataKey="category"
                            type="category"
                            tick={{ fontSize: 11, fill: '#000', fontWeight: 500 }}
                            width={90}
                        />
                        <Tooltip formatter={(val: number) => val.toLocaleString()} cursor={{ fill: 'transparent' }} />

                        <Bar dataKey="amount" fill="#333" radius={[0, 4, 4, 0]} barSize={20}>
                            <LabelList dataKey="amount" position="right" formatter={(val: any) => Number(val).toLocaleString()} style={{ fill: '#333', fontWeight: 'bold' }} />
                            {sortedMonthly.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={index === 0 ? '#ef4444' : '#334155'} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

export function ExpenseCharts({ dailyData, monthlyData }: ExpenseChartsProps) {
    return (
        <div className="w-full space-y-12">
            <div className="break-inside-avoid">
                <DailyExpensesChart dailyData={dailyData} />
            </div>
            <div className="break-inside-avoid">
                <MonthlyExpensesChart monthlyData={monthlyData} />
            </div>
        </div>
    );
}
