import { MarketList } from "./MarketList";
import { AdminCard, PageHeader } from "./components/AdminComponents";
import { LayoutDashboard, Users, ShoppingBag, Package, FileChartColumn, CreditCard } from "lucide-react";

export const dynamic = 'force-dynamic';

export default function AdminHome() {
	return (
		<div className="space-y-8">
			<PageHeader title="Admin Overview" description="Welcome back. Here's what's happening today." />

			<MarketList />

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<AdminCard
					title="Tables"
					description="Manage pool tables, rates, and detailed configurations."
					href="/admin/tables"
					icon={LayoutDashboard}
				/>
				<AdminCard
					title="Inventory"
					description="Track stock levels, units, and perform manual adjustments."
					href="/admin/inventory"
					icon={Package}
				/>
				<AdminCard
					title="Staff"
					description="Manage user roles, permissions, and access levels."
					href="/admin/staff"
					icon={Users}
				/>
				<AdminCard
					title="Products"
					description="Update the menu, prices, and product categories."
					href="/admin/products"
					icon={ShoppingBag}
				/>
				<AdminCard
					title="Reports"
					description="View detailed revenue breakdown and performance metrics."
					href="/admin/reports"
					icon={FileChartColumn}
				/>
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



