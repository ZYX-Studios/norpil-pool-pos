"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";

export function PullToRefresh({ children }: { children: React.ReactNode }) {
    const router = useRouter();
    const [startY, setStartY] = useState(0);
    const [pullDistance, setPullDistance] = useState(0);
    const [refreshing, setRefreshing] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const MIN_PULL_DISTANCE = 80;

    const handleTouchStart = (e: React.TouchEvent) => {
        if (window.scrollY === 0) {
            setStartY(e.touches[0].clientY);
        }
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        const currentY = e.touches[0].clientY;
        const diff = currentY - startY;

        if (window.scrollY === 0 && diff > 0 && startY > 0) {
            // Prevent default usually cancels scrolling, but we want to allow scrolling if not pulling?
            // Actually, we only want to intervene if we are at top.
            // setPullDistance(diff);
            // Damping effect
            setPullDistance(diff * 0.5);
        }
    };

    const handleTouchEnd = async () => {
        if (pullDistance > MIN_PULL_DISTANCE) {
            setRefreshing(true);
            setPullDistance(MIN_PULL_DISTANCE); // Snap to loading position

            // Trigger Refresh
            router.refresh();

            // Fake wait for visual feedback since router.refresh is async but doesn't return a promise we can await easily for completion
            // But we can just wait a bit.
            setTimeout(() => {
                setRefreshing(false);
                setPullDistance(0);
            }, 1000);
        } else {
            setPullDistance(0);
        }
        setStartY(0);
    };

    return (
        <div
            ref={containerRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="min-h-screen relative"
        >
            {/* Loading Indicator */}
            <div
                className="absolute left-0 right-0 flex justify-center pointer-events-none transition-all duration-200 ease-out"
                style={{
                    top: refreshing ? '20px' : '-40px',
                    transform: `translateY(${!refreshing ? pullDistance : 0}px)`,
                    opacity: Math.min(pullDistance / 40, 1)
                }}
            >
                <div className={`h-8 w-8 rounded-full bg-white shadow-lg flex items-center justify-center text-emerald-500 ${refreshing ? 'animate-spin' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                        <path d="M21 3v5h-5" />
                    </svg>
                </div>
            </div>

            {/* Content */}
            <div
                style={{
                    transform: `translateY(${pullDistance}px)`,
                    transition: refreshing ? 'transform 0.2s' : 'none'
                }}
            >
                {children}
            </div>
        </div>
    );
}
