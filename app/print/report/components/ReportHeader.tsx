import { Logo } from "@/app/components/ui/Logo";

interface ReportHeaderProps {
    title: string;
    period?: string;
}

export function ReportHeader({ title, period }: ReportHeaderProps) {
    return (
        <div className="flex justify-between items-end mb-8 pt-4 border-b-4 border-black pb-2">
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-sm">
                    <Logo className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-3xl font-black text-black tracking-tighter uppercase leading-none">
                    {title}
                </h1>
            </div>
            {period && (
                <div className="text-right">
                    <p className="text-[9px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">Report Period</p>
                    <p className="font-mono text-xs font-bold text-neutral-700">{period}</p>
                </div>
            )}
        </div>
    );
}
