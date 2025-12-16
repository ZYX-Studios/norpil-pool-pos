import { MarketList } from "./MarketList";
import { AdminCard, PageHeader } from "./components/AdminComponents";
import { LayoutDashboard, Users, ShoppingBag, Package, FileChartColumn, CreditCard } from "lucide-react";

import { getCurrentUserWithStaff } from "@/lib/auth/serverUser";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function AdminHome() {
	const { staff } = await getCurrentUserWithStaff();
	if (!staff) redirect("/auth/login");

	const isAdmin = staff.role === "ADMIN";

	return (
		<div className="space-y-8">
			<PageHeader title="Admin Overview" description="Welcome back. Here's what's happening today." />

			<MarketList />

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{isAdmin && (
					<AdminCard
						title="Tables"
						description="Manage pool tables, rates, and detailed configurations."
						href="/admin/tables"
						icon={LayoutDashboard}
					/>
				)}
				<AdminCard
					title="Inventory"
					description="Track stock levels, units, and perform manual adjustments."
					href="/admin/inventory"
					icon={Package}
				/>
				{isAdmin && (
					<AdminCard
						title="Staff"
						description="Manage user roles, permissions, and access levels."
						href="/admin/staff"
						icon={Users}
					/>
				)}
				<AdminCard
					title="Products"
					description="Update the menu, prices, and product categories."
					href="/admin/products"
					icon={ShoppingBag}
				/>
				{isAdmin && (
					<AdminCard
						title="Reports"
						description="View detailed revenue breakdown and performance metrics."
						href="/admin/reports"
						icon={FileChartColumn}
					/>
				)}
				<AdminCard
					title="POS"
					description="Jump to the Point of Sale interface to manage sessions."
					href="/pos"
					icon={CreditCard}
				/>
			</div>
			<p className="text-sm text-neutral-600 text-center pt-8">
				Analytics reflect paid orders only.
			</p>
		</div>
	);
}



