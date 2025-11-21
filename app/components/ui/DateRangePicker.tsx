"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";

interface DateRangePickerProps {
    defaultStart: string;
    defaultEnd: string;
}

export function DateRangePicker({ defaultStart, defaultEnd }: DateRangePickerProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [start, setStart] = useState(defaultStart);
    const [end, setEnd] = useState(defaultEnd);

    // Sync state if URL params change externally
    useEffect(() => {
        setStart(defaultStart);
        setEnd(defaultEnd);
    }, [defaultStart, defaultEnd]);

    const handleApply = (e: React.FormEvent) => {
        e.preventDefault();
        const params = new URLSearchParams(searchParams.toString());
        params.set("start", start);
        params.set("end", end);
        router.push(`?${params.toString()}`);
    };

    return (
        <form
            onSubmit={handleApply}
            className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur"
        >
            <div className="flex flex-wrap items-end gap-3">
                <div>
                    <label className="mb-1 block text-xs text-neutral-300">Start date</label>
                    <input
                        type="date"
                        value={start}
                        onChange={(e) => setStart(e.target.value)}
                        className="rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
                    />
                </div>
                <div>
                    <label className="mb-1 block text-xs text-neutral-300">End date</label>
                    <input
                        type="date"
                        value={end}
                        onChange={(e) => setEnd(e.target.value)}
                        className="rounded border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-50 focus:border-emerald-500/50 focus:outline-none"
                    />
                </div>
                <button
                    type="submit"
                    className="rounded-full bg-neutral-50 px-4 py-2 text-xs font-medium text-neutral-900 hover:bg-neutral-200 transition-colors"
                >
                    Apply
                </button>
            </div>
        </form>
    );
}
