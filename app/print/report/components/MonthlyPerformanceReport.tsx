"use client";

import { ReportData } from "../../../admin/reports/data";
import { DailyShiftChart } from "./charts/DailyShiftChart";
import { DailyCategoryChart } from "./charts/DailyCategoryChart";
import { PerTableChart } from "./charts/PerTableChart";
import { ExpenseCharts, DailyExpensesChart, MonthlyExpensesChart } from "./charts/ExpenseCharts";
import { ProfitLoss } from "./charts/ProfitLoss";
import { ProfitDistribution } from "./charts/ProfitDistribution";
import { CoverPage } from "./CoverPage";
import { ReportHeader } from "./ReportHeader";
import { ReportFooter } from "./ReportFooter";
import { LiabilitiesPage } from "./LiabilitiesPage";

interface MonthlyPerformanceReportProps {
    data: ReportData;
    start: string;
    end: string;
}

export function MonthlyPerformanceReport({ data, start, end }: MonthlyPerformanceReportProps) {
    const dailyStats = data.dailyStats || [];
    const salesByTable = data.overallStats?.salesByTable || {};

    // 2. Prepare Data for Per Table Chart
    const tableSalesData = Object.entries(salesByTable).map(([table, sales]) => ({
        table,
        sales
    }));

    // Check if Predator Rent exists in expenses for display purposes
    const predatorExpenseObj = data.overallStats?.expensesByCategory?.find(e => e.category.includes("Predator"));
    const predatorRentAmount = predatorExpenseObj ? predatorExpenseObj.amount : 0;

    // For display only - re-calculate sales sum if needed or just trust the expense exists
    // Let's filter tables again just to show the "Sales" part in the UI box
    const predatorTables = Object.keys(salesByTable).filter(k => k.toLowerCase().includes("predator"));
    const predatorSales = predatorTables.reduce((sum, table) => sum + (salesByTable[table] || 0), 0);

    // Transformers
    const tableData = dailyStats.map(d => ({
        date: d.date,
        morning: d.shifts.morning.tableSales,
        evening: d.shifts.evening.tableSales
    }));

    const foodData = dailyStats.map(d => ({
        date: d.date,
        morning: d.shifts.morning.foodSales,
        evening: d.shifts.evening.foodSales
    }));

    const bevNonAlcData = dailyStats.map(d => ({
        date: d.date,
        morning: d.shifts.morning.beverageSales.nonAlcoholic,
        evening: d.shifts.evening.beverageSales.nonAlcoholic
    }));

    const bevAlcData = dailyStats.map(d => ({
        date: d.date,
        morning: d.shifts.morning.beverageSales.alcoholic,
        evening: d.shifts.evening.beverageSales.alcoholic
    }));

    const bevMixedData = dailyStats.map(d => ({
        date: d.date,
        morning: d.shifts.morning.beverageSales.alcoholic + d.shifts.morning.beverageSales.nonAlcoholic,
        evening: d.shifts.evening.beverageSales.alcoholic + d.shifts.evening.beverageSales.nonAlcoholic
    }));

    const categoryData = dailyStats.map(d => ({
        date: d.date,
        table: d.shifts.morning.tableSales + d.shifts.evening.tableSales,
        food: d.shifts.morning.foodSales + d.shifts.evening.foodSales,
        beverage: d.shifts.morning.beverageSales.total + d.shifts.evening.beverageSales.total
    }));

    const expenseDailyData = dailyStats.map(d => ({
        date: d.date,
        ...d.expenses
    }));

    const startDate = new Date(start).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const endDate = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const periodStr = `${startDate} - ${endDate}`;


    // 3. Financials are now pre-calculated in data.ts
    const expenseMonthlyData = data.overallStats?.expensesByCategory || [];
    const totalRevenue = data.financials?.sales || 0;
    const totalExpenses = data.financials?.totalExpenses || 0;

    return (
        <div className="w-full">
            {/* Cover Page */}
            <CoverPage title="Monthly Performance Report" start={start} end={end} />

            {/* Page: Table Sales */}
            <div className="print-page">
                <ReportHeader title="Table Sales" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyShiftChart data={tableData} title="By Shift (Morning vs Evening)" height={550} />
                </div>
                <ReportFooter pageNumber={1} />
            </div>

            {/* Page: Per Table Sales Breakdown */}
            <div className="print-page">
                <ReportHeader title="Table Performance" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <PerTableChart data={tableSalesData} title="Total Sales Revenue Per Table" height={550} />
                    {predatorRentAmount > 0 && (
                        <div className="mt-8 p-4 bg-neutral-100 rounded border border-neutral-200">
                            <h4 className="font-bold text-black uppercase text-sm mb-2">Rent Calculation: Combined Predator Tables</h4>
                            <div className="flex justify-between text-sm font-mono border-b border-neutral-300 pb-1 mb-1">
                                <span>Predator Sales (VIP + Tournament):</span>
                                <span>{predatorSales.toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</span>
                            </div>
                            <div className="flex justify-between text-sm font-mono text-red-600 font-bold">
                                <span>Rent Expense (Included in Expenses):</span>
                                <span>{predatorRentAmount.toLocaleString('en-US', { style: 'currency', currency: 'PHP' })}</span>
                            </div>
                        </div>
                    )}
                </div>
                <ReportFooter pageNumber={2} />
            </div>

            {/* Page: Food Sales (Shift Page Number + 1) */}
            <div className="print-page">
                <ReportHeader title="Food Sales" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyShiftChart data={foodData} title="By Shift (Morning vs Evening)" height={550} />
                </div>
                <ReportFooter pageNumber={3} />
            </div>

            {/* Page: Beverages (Alcoholic) */}
            <div className="print-page">
                <ReportHeader title="Alcoholic Beverages" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyShiftChart data={bevAlcData} title="By Shift" height={550} />
                </div>
                <ReportFooter pageNumber={4} />
            </div>

            {/* Page: Beverages (Non-Alcoholic) */}
            <div className="print-page">
                <ReportHeader title="Non-Alcoholic Beverages" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyShiftChart data={bevNonAlcData} title="By Shift" height={550} />
                </div>
                <ReportFooter pageNumber={5} />
            </div>

            {/* Page: Beverages (Total) */}
            <div className="print-page">
                <ReportHeader title="Total Beverage Sales" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyShiftChart data={bevMixedData} title="By Shift" height={550} />
                </div>
                <ReportFooter pageNumber={6} />
            </div>

            {/* Page: Sales Overview */}
            <div className="print-page">
                <ReportHeader title="Sales Overview" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyCategoryChart data={categoryData} title="Total Revenue By Category" height={550} />
                </div>
                <ReportFooter pageNumber={7} />
            </div>

            {/* Page: Financials (Daily Expenses) */}
            <div className="print-page">
                <ReportHeader title="Daily Expenses" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center">
                    <DailyExpensesChart dailyData={expenseDailyData} height={500} />
                </div>
                <ReportFooter pageNumber={8} />
            </div>

            {/* Page: Financials (Monthly Breakdown) */}
            <div className="print-page">
                <ReportHeader title="Monthly Expenses Breakdown" period={periodStr} />
                <div className="flex-1 flex flex-col justify-start pt-8">
                    <MonthlyExpensesChart monthlyData={expenseMonthlyData} />
                </div>
                <ReportFooter pageNumber={9} />
            </div>

            {/* Page: Profit & Loss */}
            <div className="print-page">
                <ReportHeader title="Profit & Loss Overview" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center pt-8">
                    <ProfitLoss
                        totalRevenue={totalRevenue}
                        totalExpenses={totalExpenses}
                    />
                </div>
                <ReportFooter pageNumber={10} />
            </div>

            {/* Page: Profit Distribution */}
            <div className="print-page">
                <ReportHeader title="Profit Distribution (Dividend)" period={periodStr} />
                <div className="flex-1 flex flex-col justify-center pt-8">
                    <ProfitDistribution
                        salesData={data.overallStats.salesByItemCategory}
                        expensesData={expenseMonthlyData}
                        startDate={start}
                        endDate={end}
                    />
                </div>
                <ReportFooter pageNumber={11} />
            </div>

            {/* Page: Liabilities */}
            <LiabilitiesPage data={data} periodStr={periodStr} pageNumber={12} />
        </div>
    );
}
