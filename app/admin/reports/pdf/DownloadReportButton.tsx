"use client";

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { ReportData } from "../data";

interface DownloadReportButtonProps {
    data: ReportData;
    start: string;
    end: string;
}

export function DownloadReportButton({ data, start, end }: DownloadReportButtonProps) {
    const [isGenerating, setIsGenerating] = useState(false);

    const handleDownload = async () => {
        try {
            setIsGenerating(true);

            // Call the API route to generate the PDF
            const response = await fetch(`/api/report/download?start=${start}&end=${end}`);

            if (!response.ok) {
                throw new Error("Failed to generate report");
            }

            // Convert response to blob and trigger download
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Report_${start}_${end}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            console.error("Download failed:", error);
            alert("Failed to generate report. Please try again.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <button
            onClick={handleDownload}
            disabled={isGenerating}
            className="flex items-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 hover:bg-neutral-700 hover:text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
            {isGenerating ? (
                <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating PDF...</span>
                </>
            ) : (
                <>
                    <Download className="h-4 w-4" />
                    <span>Download Report</span>
                </>
            )}
        </button>
    );
}
