import Link from "next/link";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

// --- Page Header ---
interface PageHeaderProps {
    title: string;
    description?: string;
    children?: React.ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
    return (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
                <h1 className="text-3xl font-bold text-white tracking-tight">{title}</h1>
                {description && <p className="text-neutral-400 mt-1">{description}</p>}
            </div>
            {children && <div className="flex items-center gap-2">{children}</div>}
        </div>
    );
}

// --- Admin Card ---
interface AdminCardProps {
    title: string;
    description: string;
    href: string;
    icon?: React.ElementType;
}

export function AdminCard({ title, description, href, icon: Icon }: AdminCardProps) {
    return (
        <Link
            href={href}
            className="group relative overflow-hidden rounded-3xl border border-white/5 bg-neutral-900/50 p-6 transition-all duration-300 hover:bg-neutral-800/50 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 hover:-translate-y-1 block"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

            <div className="relative z-10 flex flex-col h-full justify-between">
                <div className="mb-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="h-10 w-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/5 group-hover:scale-110 transition-transform duration-300">
                            {Icon && <Icon className="h-5 w-5 text-neutral-300 group-hover:text-white transition-colors" />}
                        </div>
                        <ChevronRight className="h-5 w-5 text-neutral-600 group-hover:text-neutral-300 transition-colors -mr-2" />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-1 group-hover:text-indigo-200 transition-colors">{title}</h3>
                    <p className="text-sm text-neutral-400 line-clamp-2 group-hover:text-neutral-300 transition-colors">{description}</p>
                </div>
            </div>
        </Link>
    );
}
