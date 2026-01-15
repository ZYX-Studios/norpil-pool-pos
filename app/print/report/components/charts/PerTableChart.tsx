import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from "recharts";

interface PerTableChartProps {
    data: {
        table: string;
        sales: number;
    }[];
    title: string;
    height?: number;
}

export function PerTableChart({ data, title, height = 550 }: PerTableChartProps) {
    // Sort data by sales desc
    const sortedData = [...data].sort((a, b) => b.sales - a.sales);

    const dataLabelFormatter = (value: any) => {
        const num = Number(value);
        if (isNaN(num) || num === 0) return '';
        return num.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    };

    return (
        <div className="w-full mb-8">
            <div className="flex justify-between items-baseline border-b border-neutral-300 mb-4 pb-2">
                <h3 className="text-xl font-bold text-black uppercase tracking-wide">{title}</h3>
            </div>

            <div style={{ width: "100%", height: height }}>
                <ResponsiveContainer>
                    <BarChart
                        data={sortedData}
                        layout="vertical"
                        margin={{ top: 20, right: 80, left: 100, bottom: 20 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tickFormatter={(val) => val.toLocaleString('en-US', { maximumFractionDigits: 0 })} />
                        <YAxis
                            dataKey="table"
                            type="category"
                            tick={{ fontSize: 11, fill: '#000', fontWeight: 500 }}
                            width={100}
                        />
                        <Tooltip
                            formatter={(value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            cursor={{ fill: 'transparent' }}
                        />
                        <Legend wrapperStyle={{ paddingTop: '10px' }} />

                        <Bar dataKey="sales" name="Sales Revenue" fill="#334155" barSize={30} radius={[0, 4, 4, 0]}>
                            <LabelList
                                dataKey="sales"
                                position="right"
                                style={{ fontSize: '10px', fill: '#000', fontWeight: 'bold' }}
                                formatter={dataLabelFormatter}
                            />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="text-center text-xs text-neutral-500 mt-2 font-mono">
                SLATE: Total Sales Revenue per Table
            </div>
        </div>
    );
}
