"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { deleteStaffAction } from "./actions";

export function DeleteStaffButton({ id }: { id: string }) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const formData = new FormData();
            formData.append("id", id);
            await deleteStaffAction(formData);
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
                className="text-xs text-rose-400 hover:text-rose-300 hover:underline disabled:opacity-50"
            >
                {isDeleting ? "Removing..." : "Remove Staff"}
            </button>

            {showConfirm &&
                typeof document !== "undefined" &&
                createPortal(
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 backdrop-blur-sm">
                        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-neutral-950/95 p-6 text-base text-neutral-50 shadow-xl shadow-black/80">
                            <h3 className="mb-2 text-lg font-semibold text-red-400">Remove Staff Member</h3>
                            <p className="mb-6 text-neutral-400">
                                Are you sure you want to remove this staff member? They will lose access to the POS immediately.
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
                                    {isDeleting ? "Removing..." : "Remove Staff"}
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )}
        </>
    );
}
