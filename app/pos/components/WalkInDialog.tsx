'use client';

import React, { useState } from 'react';
import { CustomerSearchDialog } from "./CustomerSearchDialog";

interface WalkInDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (customerName: string, profileId?: string) => void;
}

export function WalkInDialog({
    isOpen,
    onClose,
    onConfirm,
}: WalkInDialogProps) {
    const [searchOpen, setSearchOpen] = useState(false);

    if (!isOpen) return null;

    return (
        <>
            <CustomerSearchDialog
                isOpen={searchOpen || isOpen} // Logic: Since we removed the text input, the dialog basically IS the search dialog now.
                // Actually, let's keep the wrapper just in case we add more fields later, but for now 
                // the user flow is: Click Walk-in -> Open Search -> Select/Enter -> Done.
                // So we can just delegate to CustomerSearchDialog content? 
                // But WalkInDialog is a modal. CustomerSearchDialog is a modal. 
                // Let's make WalkInDialog Render the CustomerSearchDialog directly when open.
                onClose={onClose}
                onSelectCustomer={(res) => {
                    onConfirm(res.name, res.id);
                }}
            />
        </>
    );
}
