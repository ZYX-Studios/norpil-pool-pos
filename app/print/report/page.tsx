import { createSupabaseServerClient as createClient } from "../../../lib/supabase/server";
import { getReportData } from "../../admin/reports/data";
import { PrintPageLayout } from "./components/PrintPageLayout";
import { MonthlyPerformanceReport } from "./components/MonthlyPerformanceReport";
import { redirect } from "next/navigation";

export default async function ReportPage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const start = params.start as string;
    const end = params.end as string;
    const secret = params.secret as string;

    if (!start || !end) {
        return (
            <div className="flex h-screen items-center justify-center text-neutral-500">
                Missing date range parameters
            </div>
        );
    }

    const supabase = await createClient();
    const data = await getReportData(start, end, supabase);

    return (
        <PrintPageLayout>
            <MonthlyPerformanceReport data={data} start={start} end={end} />
        </PrintPageLayout>
    );
}
