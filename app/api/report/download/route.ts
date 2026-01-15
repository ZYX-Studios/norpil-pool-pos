import { NextRequest, NextResponse } from "next/server";
import puppeteer from "puppeteer";
import chromium from "@sparticuz/chromium-min";
import puppeteerCore from "puppeteer-core";

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
        const host = req.headers.get("host") || "localhost:3000";
        const protocol = host.includes("localhost") ? "http" : "https";
        const secret = process.env.PDF_SECRET_KEY || "super-secret-local-key";
        const printUrl = `${protocol}://${host}/print/report?start=${start}&end=${end}&secret=${secret}`;

        console.log(`Generating PDF from: ${printUrl}`);

        let browser;

        if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
            // Vercel / Production: Use puppeteer-core + @sparticuz/chromium-min
            console.log("Running in production mode with @sparticuz/chromium-min");

            // Configure sparticuz/chromium
            chromium.setGraphicsMode = false;

            // You might need to adjust this path if you are using a specific version or setup
            // Usually for Vercel, this works out of the box with the package
            const executablePath = await chromium.executablePath(
                "https://github.com/Sparticuz/chromium/releases/download/v131.0.1/chromium-v131.0.1-pack.tar"
            );

            browser = await puppeteerCore.launch({
                args: chromium.args,
                defaultViewport: { width: 1123, height: 794 },
                executablePath: executablePath,
                headless: true,
            });
        } else {
            // Local Development: Use standard puppeteer
            console.log("Running in local mode with standard puppeteer");
            browser = await puppeteer.launch({
                headless: true,
                args: ["--no-sandbox", "--disable-setuid-sandbox"],
            });
        }

        const page = await browser.newPage();

        // Set viewport to A4 Landscape dimensions (approximate pixels at 96 DPI: 1123x794)
        await page.setViewport({ width: 1123, height: 794 });

        // Navigate to the print page and wait for content to load
        // We use domcontentloaded + a small delay because networkidle0 can be too slow/flaky
        await page.goto(printUrl, { waitUntil: "domcontentloaded", timeout: 30000 });

        // Wait for charts to be rendered (Recharts uses SVG)
        await page.waitForSelector('.recharts-pie', { timeout: 5000 }).catch(() => {
            console.log('No pie charts found on page');
        });

        // Add additional wait to ensure all rendering is complete
        await new Promise(resolve => setTimeout(resolve, 500));

        const pdfBuffer = await page.pdf({
            format: "A4",
            landscape: true, // Enable landscape mode
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
