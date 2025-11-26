'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deleteInventoryItemAction } from "./actions";

type InventoryDeleteButtonProps = {
    id: string;
    name: string;
};

export function InventoryDeleteButton({ id, name }: InventoryDeleteButtonProps) {
    const router = useRouter();
    const [isDeleting, setIsDeleting] = useState(false);

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${name}"? This action cannot be undone.`)) {
            return;
        }

        setIsDeleting(true);
        try {
            const res = await deleteInventoryItemAction(id);
            if (res?.error) {
                alert(res.error);
            } else {
                // Force a full page reload to ensure the UI is in sync with the server.
                // This handles cases where Next.js router cache might be stale.
                window.location.reload();
            }
        } catch (error) {
            alert("An unexpected error occurred.");
            console.error(error);
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded p-2 text-neutral-400 hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
            title="Delete item"
        >
            {isDeleting ? (
                <span className="block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                >
                    <path
                        fillRule="evenodd"
                        d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z"
                        clipRule="evenodd"
                    />
                </svg>
            )}
        </button>
    );
}
