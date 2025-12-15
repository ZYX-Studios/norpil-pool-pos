import { createClient } from "@supabase/supabase-js";
import { getReportData } from "../../admin/reports/data";
import { PrintPageLayout } from "./components/PrintPageLayout";
import { ExecutiveSummary } from "./components/ExecutiveSummary";
import { FinancialSnapshot } from "./components/FinancialSnapshot";
import { RevenueAnalysis } from "./components/RevenueAnalysis";
import { OperationsReport } from "./components/OperationsReport";
import { DailyBreakdown } from "./components/DailyBreakdown";
import { ExpensesReport } from "./components/ExpensesReport";
import { RisksIssuesOpportunities } from "./components/RisksIssuesOpportunities";
import { Appendix } from "./components/Appendix";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PrintPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[]>>;
}) {
    const sp = await searchParams;
    const start = sp?.start as string;
    const end = sp?.end as string;
    const secret = sp?.secret as string;

    // Basic security check to prevent public access to this internal view
    // In a real app, use a robust secret from env vars
    const VALID_SECRET = process.env.PDF_SECRET_KEY || "super-secret-local-key";
    if (secret !== VALID_SECRET) {
        return (
            <div className="flex h-screen items-center justify-center text-red-500">
                Unauthorized Access
            </div>
        );
    }

    if (!start || !end) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-500">
                Missing date range parameters
            </div>
        );
    }

    // Use Service Role to bypass RLS for internal report generation
    // We check multiple variable names to handle prefixes or typos
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABSE_SERVICE_ROLE_KEY;

    let data;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && serviceKey) {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            serviceKey,
            {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                    detectSessionInUrl: false,
                },
            }
        );
        data = await getReportData(start, end, supabaseAdmin);
    } else {
        // Fallback to default (might miss data due to RLS)
        console.warn("Missing Service Role Key. Falling back to anon client.");
        data = await getReportData(start, end);
    }

    // Format dates for display
    const startDate = new Date(start).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const endDate = new Date(end).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    });
    const reportDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

    return (
        <PrintPageLayout>
            {/* PAGE 1: COVER */}
            <div className="print-page justify-center text-center">
                <div className="mb-12">
                    <h1 className="text-5xl font-bold tracking-tight text-neutral-900">
                        NORPIL BILLIARDS
                    </h1>
                    <div className="mt-4 h-1 w-32 bg-neutral-900 mx-auto"></div>
                </div>

                <div className="mb-24">
                    <h2 className="text-3xl font-light uppercase tracking-[0.2em] text-neutral-600">
                        Monthly Performance Report
                    </h2>
                </div>

                <div className="space-y-4 text-lg text-neutral-800">
                    <p>
                        <span className="font-semibold text-neutral-500 uppercase tracking-wider text-sm block mb-1">Reporting Period</span>
                        {startDate} — {endDate}
                    </p>
                </div>

                <div className="absolute bottom-20 left-0 right-0 text-center">
                    <p className="text-sm text-neutral-400">
                        Generated on {reportDate}
                    </p>
                    <p className="text-xs text-neutral-300 mt-2">
                        CONFIDENTIAL — INTERNAL USE ONLY
                    </p>
                </div>
            </div>

            {/* PAGE 2: EXECUTIVE SUMMARY */}
            <ExecutiveSummary data={data} start={start} end={end} />

            {/* PAGE 3: FINANCIAL SNAPSHOT */}
            <FinancialSnapshot data={data} />

            {/* PAGE 4: REVENUE ANALYSIS */}
            <RevenueAnalysis data={data} />

            {/* PAGE 5: OPERATIONS REPORT */}
            <OperationsReport data={data} />

            {/* PAGE 6: DAILY BREAKDOWN */}
            <DailyBreakdown data={data} />

            {/* PAGE 7: EXPENSES REPORT */}
            <ExpensesReport data={data} />

            {/* PAGE 8: RISKS, ISSUES, OPPORTUNITIES */}
            <RisksIssuesOpportunities data={data} />

            {/* PAGE 9: APPENDIX */}
            <Appendix data={data} />
        </PrintPageLayout>
    );
}
