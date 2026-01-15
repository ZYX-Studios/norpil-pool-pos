import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

interface DailyShiftChartProps {
    data: {
        date: string;
        morning: number;
        evening: number;
    }[];
    title: string;
    height?: number;
}

export function DailyShiftChart({ data, title, height = 300 }: DailyShiftChartProps) {
    // Format dates for axis (DD) and round values
    const formattedData = data.map(d => ({
        ...d,
        day: new Date(d.date).getDate(), // Just the day number
        morning: Number(d.morning.toFixed(1)),
        evening: Number(d.evening.toFixed(1)),
        total: Number((d.morning + d.evening).toFixed(1))
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
                    Gross Sales: <span className="underline decoration-double text-xl">{totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</span>
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
                            tickFormatter={(value) => value.toLocaleString('en-US', { maximumFractionDigits: 0 })} // Y-Axis can stay integers for cleaner look
                        />
                        <Tooltip
                            formatter={(value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                            labelFormatter={(label) => `Day ${label}`}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />

                        <Bar dataKey="morning" name="Morning" stackId="a" fill="#93c5fd">
                            <LabelList
                                dataKey="morning"
                                position="center"
                                style={{ fontSize: '8px', fill: '#000', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                        </Bar>
                        <Bar dataKey="evening" name="Evening" stackId="a" fill="#1e40af">
                            <LabelList
                                dataKey="evening"
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
                LIGHT BLUE: Morning | DARK BLUE: Evening
            </div>
        </div>
    );
}
