"use client";

import { Pencil } from "lucide-react";
import { useState } from "react";

interface ProfileNameEditProps {
    currentName: string;
    updateAction: (formData: FormData) => Promise<void>;
}

export function ProfileNameEdit({ currentName, updateAction }: ProfileNameEditProps) {
    const [isEditing, setIsEditing] = useState(false);
    const [name, setName] = useState(currentName);

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        await updateAction(formData);
        setIsEditing(false);
    }

    if (isEditing) {
        return (
            <form onSubmit={handleSubmit} className="space-y-2">
                <input
                    type="text"
                    name="full_name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your Name"
                    autoFocus
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-white font-bold text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50"
                />
                <div className="flex items-center gap-2">
                    <button
                        type="submit"
                        className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/20 transition"
                    >
                        Save
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            setIsEditing(false);
                            setName(currentName);
                        }}
                        className="flex-1 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-neutral-400 hover:bg-white/10 transition"
                    >
                        Cancel
                    </button>
                </div>
            </form>
        );
    }

    return (
        <div className="flex items-center gap-2">
            <h2 className="font-bold text-lg text-white flex-1">{currentName || "Guest User"}</h2>
            <button
                onClick={() => setIsEditing(true)}
                className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-neutral-400 hover:bg-white/10 hover:text-white transition"
                title="Edit name"
            >
                <Pencil className="h-4 w-4" />
            </button>
        </div>
    );
}
