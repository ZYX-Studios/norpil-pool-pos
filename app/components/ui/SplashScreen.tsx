"use client";

import { useEffect, useState } from "react";
import { Logo } from "@/app/components/ui/Logo";
import { cn } from "@/lib/utils";

export function SplashScreen() {
    const [isVisible, setIsVisible] = useState(true);
    const [shouldRender, setShouldRender] = useState(true);

    useEffect(() => {
        // Start fading out after 1.5s
        const timer = setTimeout(() => {
            setIsVisible(false);
        }, 1500);

        // Remove from DOM after fade out completes (500ms transition)
        const cleanupTimer = setTimeout(() => {
            setShouldRender(false);
        }, 2000);

        return () => {
            clearTimeout(timer);
            clearTimeout(cleanupTimer);
        };
    }, []);

    if (!shouldRender) return null;

    return (
        <div
            className={cn(
                "fixed inset-0 z-50 flex items-center justify-center bg-deep-black transition-opacity duration-1000 ease-in-out",
                isVisible ? "opacity-100" : "opacity-0 pointer-events-none"
            )}
            aria-hidden={!isVisible}
        >
            <div className="relative">
                <Logo className="h-24 w-24 text-white" />
            </div>
        </div>
    );
}
