interface ReportFooterProps {
    pageNumber: number;
    totalPages?: number;
}

export function ReportFooter({ pageNumber, totalPages }: ReportFooterProps) {
    return (
        <div className="mt-auto pt-4 border-t border-neutral-200 flex justify-between items-center text-[10px] text-neutral-500 font-mono">
            <div className="uppercase tracking-wider">
                Norpil Pool Hall &bull; <span className="text-black font-bold">Confidential</span>
            </div>
            <div className="font-bold text-black">
                Page {pageNumber}
            </div>
        </div>
    );
}
