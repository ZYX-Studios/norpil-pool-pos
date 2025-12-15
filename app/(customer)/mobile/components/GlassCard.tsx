import React from "react";

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
}

export function GlassCard({ children, className = "", onClick }: GlassCardProps) {
    return (
        <div
            onClick={onClick}
            className={`
                relative overflow-hidden rounded-2xl 
                border border-white/10 bg-white/5 
                p-6 backdrop-blur-xl transition-all 
                hover:bg-white/10 active:scale-95 
                shadow-lg shadow-black/20
                ${className}
            `}
        >
            {/* Subtle gradient overlay for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 pointer-events-none transition-opacity group-hover:opacity-100" />

            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
