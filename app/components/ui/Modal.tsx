"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { X } from "lucide-react"

interface ModalProps {
    isOpen: boolean
    onClose: () => void
    title: string
    description?: string
    children: React.ReactNode
    footer?: React.ReactNode
}

export function Modal({ isOpen, onClose, title, description, children, footer }: ModalProps) {
    if (!isOpen) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-zinc-900/95 p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 text-white"
                >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                </button>
                <div className="flex flex-col space-y-1.5 text-center sm:text-left mb-4">
                    <h2 className="text-lg font-semibold leading-none tracking-tight text-white">{title}</h2>
                    {description && <p className="text-sm text-neutral-400">{description}</p>}
                </div>
                <div className="text-white">
                    {children}
                </div>
                {footer && (
                    <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-6">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    )
}
