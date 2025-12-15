'use client';

import { useState, useRef, useEffect } from 'react';
import { createInventoryItem } from './actions';

type InventoryAddFormProps = {
    existingItemNames: string[];
};

export function InventoryAddForm({ existingItemNames }: InventoryAddFormProps) {
    const [inputValue, setInputValue] = useState('');
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // Close suggestions when clicking outside
        function handleClickOutside(event: MouseEvent) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setInputValue(value);

        if (value.length > 0) {
            const filtered = existingItemNames
                .filter((name) => name.toLowerCase().includes(value.toLowerCase()))
                .slice(0, 5); // Limit to top 5 matches
            setSuggestions(filtered);
            setShowSuggestions(true);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const handleSuggestionClick = (name: string) => {
        setInputValue(name);
        setShowSuggestions(false);
        inputRef.current?.focus();
    };

    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-sm shadow-black/40 backdrop-blur">
            <h2 className="mb-3 text-lg font-semibold">Add Inventory Item</h2>
            <form action={createInventoryItem} className="grid grid-cols-1 gap-3 sm:grid-cols-5">

                {/* Name Input with Autocomplete */}
                <div className="relative sm:col-span-2" ref={wrapperRef}>
                    <input
                        ref={inputRef}
                        name="name"
                        value={inputValue}
                        onChange={handleInputChange}
                        onFocus={() => {
                            if (inputValue.length > 0 && suggestions.length > 0) setShowSuggestions(true);
                        }}
                        placeholder="Name"
                        className="w-full rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        required
                        autoComplete="off"
                    />

                    {/* Suggestions Dropdown */}
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-white/10 bg-neutral-900/95 shadow-xl backdrop-blur-md">
                            <div className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                                Suggestions
                            </div>
                            <ul>
                                {suggestions.map((name) => (
                                    <li key={name}>
                                        <button
                                            type="button"
                                            onClick={() => handleSuggestionClick(name)}
                                            className="w-full px-4 py-2 text-left text-sm text-neutral-200 transition-colors hover:bg-white/10 hover:text-white"
                                        >
                                            {name}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <input
                    name="sku"
                    placeholder="SKU (optional)"
                    className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 placeholder:text-neutral-500 sm:col-span-1 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />

                <div className="sm:col-span-1 relative">
                    <select
                        name="unit"
                        className="w-full appearance-none rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                        defaultValue="PCS"
                    >
                        <option value="PCS">PCS</option>
                        <option value="BOTTLE">BOTTLE</option>
                        <option value="CAN">CAN</option>
                        <option value="ML">ML</option>
                        <option value="L">L</option>
                        <option value="GRAM">GRAM</option>
                        <option value="KG">KG</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                        <svg className="h-4 w-4 fill-current" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                    </div>
                </div>

                <input
                    name="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Unit cost"
                    className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />

                <input
                    name="min_stock"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Min Stock"
                    className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />

                <input
                    name="max_stock"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Max Stock"
                    className="rounded border border-white/20 bg-black/40 px-4 py-3 text-base text-neutral-50 placeholder:text-neutral-500 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/50"
                />

                <div className="sm:col-span-5">
                    <button type="submit" className="w-full rounded bg-neutral-900 px-4 py-3 text-base font-medium text-white transition-colors hover:bg-neutral-800">
                        Add
                    </button>
                </div>
            </form>
        </div>
    );
}
