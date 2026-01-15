import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

interface DailyCategoryChartProps {
    data: {
        date: string;
        table: number;
        food: number;
        beverage: number;
    }[];
    title: string;
    height?: number;
}

export function DailyCategoryChart({ data, title, height = 300 }: DailyCategoryChartProps) {
    const formattedData = data.map(d => ({
        ...d,
        day: new Date(d.date).getDate(),
        table: Number(d.table.toFixed(1)),
        food: Number(d.food.toFixed(1)),
        beverage: Number(d.beverage.toFixed(1)),
        total: Number((d.table + d.food + d.beverage).toFixed(1))
    }));

    const totalRevenue = formattedData.reduce((sum, d) => sum + d.total, 0);

    const dataLabelFormatter = (value: any) => {
        const num = Number(value);
        if (isNaN(num) || num === 0) return '';
        return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    return (
        <div className="w-full mb-8">
            <div className="flex justify-between items-baseline border-b border-neutral-300 mb-4 pb-2">
                <h3 className="text-xl font-bold text-black uppercase tracking-wide">{title}</h3>
                <div className="text-lg font-bold text-blue-600">
                    Total: <span className="underline decoration-double text-xl">{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
                </div>
            </div>

            <div style={{ width: "100%", height: height }}>
                <ResponsiveContainer>
                    <BarChart
                        data={formattedData}
                        margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="day"
                            tick={{ fontSize: 10, fill: '#666' }}
                            interval={0}
                        />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#666' }}
                            tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        />
                        <Tooltip
                            formatter={(value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            labelFormatter={(label) => `Day ${label}`}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} iconType="circle" />

                        <Bar dataKey="table" name="Table" stackId="a" fill="#334155">
                            <LabelList
                                dataKey="table"
                                position="center"
                                style={{ fontSize: '8px', fill: '#fff', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                        </Bar>
                        <Bar dataKey="food" name="Food" stackId="a" fill="#d97706">
                            <LabelList
                                dataKey="food"
                                position="center"
                                style={{ fontSize: '8px', fill: '#fff', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                        </Bar>
                        <Bar dataKey="beverage" name="Beverage" stackId="a" fill="#0d9488">
                            <LabelList
                                dataKey="beverage"
                                position="center"
                                style={{ fontSize: '8px', fill: '#fff', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                            <LabelList
                                dataKey="total"
                                position="top"
                                style={{ fontSize: '10px', fill: '#000', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="text-center text-xs text-neutral-500 mt-2 font-mono">
                SLATE: Table | AMBER: Food | TEAL: Beverage
            </div>
        </div>
    );
}
