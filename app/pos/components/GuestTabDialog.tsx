'use client';

import { useState } from "react";

interface GuestTabDialogProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (name: string, phone: string) => Promise<void>;
}

export function GuestTabDialog({ isOpen, onClose, onSubmit }: GuestTabDialogProps) {
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [error, setError] = useState<string | null>(null);
	const [isSubmitting, setIsSubmitting] = useState(false);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError(null);

		// Validate
		if (!name.trim()) {
			setError('Name is required');
			return;
		}
		if (!phone.trim()) {
			setError('Phone number is required');
			return;
		}

		// Validate Philippine phone format
		const phoneClean = phone.replace(/[\s\-]/g, '');
		const isValidPhone = /^(09|\+639)\d{9}$/.test(phoneClean);
		if (!isValidPhone) {
			setError('Please enter a valid Philippine phone number (09XXXXXXXXX or +639XXXXXXXXX)');
			return;
		}

		setIsSubmitting(true);
		try {
			await onSubmit(name.trim(), phoneClean);
			// Reset on success
			setName('');
			setPhone('');
			onClose();
		} catch (err: any) {
			setError(err.message || 'Failed to create guest customer');
		} finally {
			setIsSubmitting(false);
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
			<div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 w-full max-w-md shadow-xl">
				<h2 className="text-xl font-bold text-neutral-100 mb-2">Guest Charge to Tab</h2>
				<p className="text-sm text-neutral-400 mb-4">
					Enter guest details to create a tab account for charging.
				</p>

				<form onSubmit={handleSubmit}>
					<div className="space-y-4">
						{/* Name Input */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Guest Name <span className="text-red-400">*</span>
							</label>
							<input
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								className="w-full p-3 border border-neutral-700 rounded-lg bg-neutral-800/50 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								placeholder="Enter guest name"
								disabled={isSubmitting}
							/>
						</div>

						{/* Phone Input */}
						<div>
							<label className="block text-sm font-medium text-neutral-300 mb-1">
								Phone Number <span className="text-red-400">*</span>
							</label>
							<input
								type="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								className="w-full p-3 border border-neutral-700 rounded-lg bg-neutral-800/50 text-neutral-100 placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
								placeholder="09XXXXXXXXX or +639XXXXXXXXX"
								disabled={isSubmitting}
							/>
							<p className="text-xs text-neutral-500 mt-1">
								Required for collection follow-up
							</p>
						</div>

						{/* Error Display */}
						{error && (
							<div className="p-3 bg-red-900/30 border border-red-500/30 text-red-400 rounded-lg text-sm">
								{error}
							</div>
						)}

						{/* Actions */}
						<div className="flex gap-3 pt-4">
							<button
								type="button"
								onClick={onClose}
								className="flex-1 p-3 border border-neutral-700 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 hover:text-neutral-100 transition"
								disabled={isSubmitting}
							>
								Cancel
							</button>
							<button
								type="submit"
								className="flex-1 p-3 bg-emerald-600 text-white rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:hover:bg-emerald-600 transition font-medium"
								disabled={isSubmitting}
							>
								{isSubmitting ? 'Creating...' : 'Continue'}
							</button>
						</div>
					</div>
				</form>
			</div>
		</div>
	);
}
