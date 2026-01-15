import { Logo } from "@/app/components/ui/Logo";

interface CoverPageProps {
    title: string;
    start: string;
    end: string;
}

export function CoverPage({ title, start, end }: CoverPageProps) {
    const startDate = new Date(start).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    const endDate = new Date(end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    // Use inline styles for background colors to ensure Puppeteer renders them accurately regardless of CSS classes
    return (
        <div className="print-page flex flex-col relative overflow-hidden text-neutral-900 !p-0" style={{ backgroundColor: '#ffffff' }}>

            {/* Geometric Accents - Subtle Light Theme */}
            <div className="absolute top-0 right-0 w-[60%] h-full bg-neutral-100 origin-bottom-right -skew-x-12" />
            <div className="absolute bottom-0 left-0 w-[40%] h-[120%] bg-neutral-50 origin-bottom-left skew-x-12 border-r border-neutral-100" />

            {/* Top Bar */}
            <div className="relative z-10 w-full p-12 flex justify-between items-start">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 flex items-center justify-center rounded border-2 border-black">
                        <Logo className="w-8 h-8 text-black" />
                    </div>
                    <div className="uppercase tracking-widest font-bold text-sm text-black">
                        Norpil Billiards
                    </div>
                </div>
                <div className="text-right">
                    <div className="px-4 py-1 bg-black text-white rounded-full border border-black">
                        <span className="text-xs font-mono font-bold">CONFIDENTIAL</span>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="relative z-10 flex-1 flex flex-col justify-center px-24">
                <div className="w-24 h-2 bg-black mb-8" />

                <h1 className="text-8xl font-black tracking-tighter leading-[0.9] mb-8 text-black">
                    MONTHLY<br />
                    PERFORMANCE<br />
                    REPORT
                </h1>

                <div className="flex items-center gap-6 mt-8">
                    <div className="border-l-4 border-black pl-6">
                        <p className="text-sm text-neutral-500 uppercase tracking-widest mb-1 font-bold">Reporting Period</p>
                        <p className="text-3xl font-light text-black">
                            {startDate} <span className="text-neutral-400 mx-2">—</span> {endDate}
                        </p>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="relative z-10 w-full p-12 flex justify-between items-end border-t border-neutral-200 bg-white/50 backdrop-blur-md">
                <div>
                    <p className="text-[10px] text-neutral-400 uppercase tracking-widest mb-2">Generated</p>
                    <p className="font-mono text-sm text-neutral-900 font-bold">{today}</p>
                </div>

                <div className="text-right">
                    <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                        This document contains proprietary information. <br />
                        Unauthorized distribution is strictly prohibited.
                    </p>
                </div>
            </div>
        </div>
    );
}
