"use client";

import { useState, useRef, useEffect } from "react";

interface RangeSliderProps {
    min: number;
    max: number;
    step: number;
    minValue: number;
    maxValue: number;
    onChange: (min: number, max: number) => void;
}

export function RangeSlider({ min, max, step, minValue, maxValue, onChange }: RangeSliderProps) {
    const [isDragging, setIsDragging] = useState<'min' | 'max' | null>(null);
    const trackRef = useRef<HTMLDivElement>(null);

    const getPercentage = (value: number) => ((value - min) / (max - min)) * 100;

    const handleMouseDown = (type: 'min' | 'max') => {
        setIsDragging(type);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging || !trackRef.current) return;

            const rect = trackRef.current.getBoundingClientRect();
            const percentage = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
            const value = min + (percentage / 100) * (max - min);
            const snappedValue = Math.round(value / step) * step;

            if (isDragging === 'min' && snappedValue <= maxValue) {
                onChange(snappedValue, maxValue);
            } else if (isDragging === 'max' && snappedValue >= minValue) {
                onChange(minValue, snappedValue);
            }
        };

        const handleMouseUp = () => {
            setIsDragging(null);
        };

        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, min, max, step, minValue, maxValue, onChange]);

    const minPercentage = getPercentage(minValue);
    const maxPercentage = getPercentage(maxValue);

    return (
        <div className="relative w-full">
            {/* Track */}
            <div ref={trackRef} className="relative h-2 bg-white/10 rounded-full cursor-pointer">
                {/* Active range */}
                <div
                    className="absolute h-full bg-emerald-500 rounded-full"
                    style={{
                        left: `${minPercentage}%`,
                        width: `${maxPercentage - minPercentage}%`
                    }}
                />

                {/* Min handle */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full cursor-grab active:cursor-grabbing shadow-lg"
                    style={{ left: `${minPercentage}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={() => handleMouseDown('min')}
                />

                {/* Max handle */}
                <div
                    className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-emerald-500 rounded-full cursor-grab active:cursor-grabbing shadow-lg"
                    style={{ left: `${maxPercentage}%`, transform: 'translate(-50%, -50%)' }}
                    onMouseDown={() => handleMouseDown('max')}
                />
            </div>
        </div>
    );
}
