'use client';

import { useState } from "react";
import { createPortal } from "react-dom";
import { deleteTableAction } from "./actions";

type TableDeleteButtonProps = {
    id: string;
    name: string;
};

export function TableDeleteButton({ id, name }: TableDeleteButtonProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = async () => {
        console.log("Delete confirmed, calling action...");
        setIsDeleting(true);
        try {
            const res = await deleteTableAction(id);
            if (res?.error) {
                alert(res.error);
            }
        } catch (error) {
            alert("An unexpected error occurred.");
            console.error(error);
        } finally {
            setIsDeleting(false);
            setShowConfirm(false);
        }
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setShowConfirm(true)}
                disabled={isDeleting}
                className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-red-300 hover:bg-red-500/20 hover:border-red-500/30 disabled:opacity-50"
                title="Delete table"
            >
                {isDeleting ? "..." : "Delete"}
            </button>

            {showConfirm &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950/95 p-6 text-base text-neutral-50 shadow-xl shadow-black/80">
                            <h3 className="mb-2 text-lg font-semibold text-red-400">Delete Table</h3>
                            <p className="mb-6 text-neutral-400">
                                Are you sure you want to delete <span className="font-medium text-neutral-200">&quot;{name}&quot;</span>?
                                This action cannot be undone.
                            </p>
                            <div className="flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowConfirm(false)}
                                    className="rounded-full border border-white/20 px-4 py-2 text-sm text-neutral-200 hover:bg-white/10"
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    className="rounded-full bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-50"
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Deleting..." : "Delete Table"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
