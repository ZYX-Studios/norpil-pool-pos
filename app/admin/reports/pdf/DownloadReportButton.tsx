"use client";

import React, { useEffect, useState } from "react";
import { PDFDownloadLink } from "@react-pdf/renderer";
import { ExecutiveReport } from "./ExecutiveReport";
import { ReportData } from "../data";
import { Download } from "lucide-react";

interface DownloadReportButtonProps {
    data: ReportData;
    start: string;
    end: string;
}

export const DownloadReportButton = ({ data, start, end }: DownloadReportButtonProps) => {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return null;
    }

    return (
        <PDFDownloadLink
            document={<ExecutiveReport data={data} start={start} end={end} />}
            fileName={`executive-report-${start}-to-${end}.pdf`}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
        >
            {({ blob, url, loading, error }) =>
                loading ? (
                    <>Loading document...</>
                ) : (
                    <>
                        <Download className="w-4 h-4" />
                        Download Report
                    </>
                )
            }
        </PDFDownloadLink>
    );
};
