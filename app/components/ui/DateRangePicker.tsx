"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { format, subDays } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Calendar } from "@/app/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/app/components/ui/popover";

interface DateRangePickerProps {
    defaultStart: string;
    defaultEnd: string;
}

export function DateRangePicker({ defaultStart, defaultEnd }: DateRangePickerProps) {
    const router = useRouter();
    const [date, setDate] = useState<DateRange | undefined>({
        from: defaultStart ? new Date(defaultStart) : new Date(),
        to: defaultEnd ? new Date(defaultEnd) : new Date(),
    });

    useEffect(() => {
        setDate({
            from: defaultStart ? new Date(defaultStart) : new Date(),
            to: defaultEnd ? new Date(defaultEnd) : new Date(),
        });
    }, [defaultStart, defaultEnd]);

    const handleSelect = (selectedDate: DateRange | undefined) => {
        setDate(selectedDate);

        if (selectedDate?.from && selectedDate?.to) {
            const startStr = format(selectedDate.from, "yyyy-MM-dd");
            const endStr = format(selectedDate.to, "yyyy-MM-dd");

            // Optional: Auto-apply or keep Apply button.
            // Usually nice to auto-apply if range is complete, but let's keep it manual or auto?
            // User asked for "update the calendar", usually auto-fetching is nice but might be heavy.
            // Let's stick to auto-apply for better UX if range is complete.

            const params = new URLSearchParams(window.location.search);
            params.set("start", startStr);
            params.set("end", endStr);
            router.push(`?${params.toString()}`);
        }
    };

    return (
        <div className={cn("grid gap-2")}>
            <Popover>
                <PopoverTrigger asChild>
                    <button
                        id="date"
                        className={cn(
                            "w-[300px] justify-start text-left font-normal flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-800 px-3 py-2 text-sm text-neutral-300 hover:bg-neutral-700 transition-colors",
                            !date && "text-muted-foreground"
                        )}
                    >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {format(date.from, "LLL dd, y")} -{" "}
                                    {format(date.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(date.from, "LLL dd, y")
                            )
                        ) : (
                            <span>Pick a date</span>
                        )}
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={handleSelect}
                        numberOfMonths={2}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
