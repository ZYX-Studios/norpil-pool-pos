import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";

export const runtime = "nodejs"; // Force Node.js runtime for Puppeteer
export const dynamic = "force-dynamic"; // Disable caching

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
        return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
    }

    try {
        // Construct the URL for the print page
        // We use the new public route /print/report to bypass AdminLayout auth
        const host = req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const secret = process.env.PDF_SECRET_KEY || "super-secret-local-key";
        const printUrl = `${protocol}://${host}/print/report?start=${start}&end=${end}&secret=${secret}`;

        console.log(`Generating PDF from: ${printUrl}`);

        const browser = await puppeteer.launch({
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"],
        });

        const page = await browser.newPage();

        // Set viewport to A4 dimensions (approximate pixels at 96 DPI)
        await page.setViewport({ width: 794, height: 1123 });

        // Navigate to the print page and wait for network to be idle (charts loaded)
        await page.goto(printUrl, { waitUntil: "networkidle0", timeout: 60000 });

        // Wait for charts to be rendered (Recharts uses SVG)
        await page.waitForSelector('.recharts-pie', { timeout: 10000 }).catch(() => {
            console.log('No pie charts found on page');
        });

        // Add additional wait to ensure all rendering is complete
        await new Promise(resolve => setTimeout(resolve, 2000));

        const pdfBuffer = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: { top: 0, right: 0, bottom: 0, left: 0 }, // We handle margins in CSS
        });

        await browser.close();

        return new NextResponse(pdfBuffer as any, {
            headers: {
                "Content-Type": "application/pdf",
                "Content-Disposition": `attachment; filename="Report_${start}_${end}.pdf"`,
            },
        });
    } catch (error) {
        console.error("PDF Generation Error:", error);
        return NextResponse.json(
            { error: "Failed to generate PDF", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
