import Link from "next/link";

export const dynamic = 'force-dynamic';

export default function AdminHome() {
	return (
		<div className="space-y-6">
			<h1 className="text-2xl font-semibold">Admin Overview</h1>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Link href="/admin/tables" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">Tables</div>
					<p className="mt-1 text-sm text-neutral-300">Add, rename, or change rates for regular and VIP tables.</p>
				</Link>
				<Link href="/admin/inventory" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">Inventory</div>
					<p className="mt-1 text-sm text-neutral-300">Manage stock items, units, and manual adjustments.</p>
				</Link>
				<Link href="/admin/staff" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">Staff</div>
					<p className="mt-1 text-sm text-neutral-300">See who can log in and adjust roles (Admin, Cashier, Waiter).</p>
				</Link>
				<Link href="/admin/products" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">Products</div>
					<p className="mt-1 text-sm text-neutral-300">Manage the menu of drinks, food, and table-time items.</p>
				</Link>
				<Link href="/admin/reports" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">Reports</div>
					<p className="mt-1 text-sm text-neutral-300">See revenue by day, product category, and payment method.</p>
				</Link>
				<Link href="/pos" className="rounded-2xl border border-white/10 bg-white/5 p-6 shadow-sm shadow-black/40 hover:bg-white/10">
					<div className="text-lg font-semibold text-neutral-50">POS</div>
					<p className="mt-1 text-sm text-neutral-300">Jump back to the live POS to manage tables.</p>
				</Link>
			</div>
			<p className="text-sm text-neutral-500">
				Reports include only paid orders. Use POS → Pay & Close to record payments.
			</p>
		</div>
	);
}



