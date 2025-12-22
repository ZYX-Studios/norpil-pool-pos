import { createSupabaseServerClient } from "@/lib/supabase/server";
import { format } from "date-fns";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("search") || "";
    const typeFilter = searchParams.get("type") || "ALL";

    const supabase = createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
        return new NextResponse("Unauthorized", { status: 401 });
    }

    // Build Query matches page logic, but NO pagination
    let tableQuery = supabase
        .from("admin_transactions")
        .select("*")
        .order("created_at", { ascending: false });

    // Apply Search
    if (query) {
        tableQuery = tableQuery.or(`customer_name.ilike.%${query}%,description.ilike.%${query}%,method.ilike.%${query}%`);
    }

    // Apply Type Filter
    if (typeFilter !== "ALL") {
        tableQuery = tableQuery.eq("type", typeFilter);
    }

    // Limit execution time/rows for safety, though "export" implies all.
    // Let's limit to 5000 for now to prevent timeouts on serverless.
    tableQuery.limit(5000);

    const { data: transactions, error } = await tableQuery;

    if (error) {
        console.error("Export Error:", error);
        return new NextResponse("Error fetching data", { status: 500 });
    }

    if (!transactions || transactions.length === 0) {
        return new NextResponse("No data found", { status: 404 });
    }

    // Convert to CSV
    const headers = ["Date", "Type", "Customer", "Description", "Method", "Amount", "Reference ID"];
    const csvRows = [headers.join(",")];

    for (const t of transactions) {
        const row = [
            `"${format(new Date(t.created_at), "yyyy-MM-dd HH:mm:ss")}"`,
            `"${t.type}"`,
            `"${escapeCsv(t.customer_name)}"`,
            `"${escapeCsv(t.description)}"`,
            `"${t.method}"`,
            t.amount.toFixed(2),
            `"${t.reference_id || ""}"`
        ];
        csvRows.push(row.join(","));
    }

    const csvContent = csvRows.join("\n");

    return new NextResponse(csvContent, {
        headers: {
            "Content-Type": "text/csv",
            "Content-Disposition": `attachment; filename="transactions-${format(new Date(), "yyyy-MM-dd-HHmm")}.csv"`,
        },
    });
}

function escapeCsv(str: string | null): string {
    if (!str) return "";
    return str.replace(/"/g, '""'); // Escape double quotes
}
