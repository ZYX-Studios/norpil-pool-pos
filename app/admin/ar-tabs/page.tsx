import { getCustomerBalances } from "@/app/ar-tabs/actions";
import { ArTabsTable } from "./ArTabsTable";

export default async function ArTabsPage() {
  const customers = await getCustomerBalances();
  
  return (
    <div className="p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Accounts Receivable (Running Tabs)</h1>
        <p className="text-gray-600 mt-2">
          Manage customer tabs, view balances, and process charges/payments.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Total Outstanding</h3>
          <p className="text-3xl font-bold mt-2">
            ₱{(customers.reduce((sum, c) => sum + (c.balance_cents || 0), 0) / 100).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Across {customers.length} customer{customers.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Active Customers</h3>
          <p className="text-3xl font-bold mt-2">
            {customers.filter(c => c.status === 'active').length}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            With credit limits
          </p>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="font-semibold text-gray-700">Average Balance</h3>
          <p className="text-3xl font-bold mt-2">
            ₱{(
              customers.length > 0 
                ? customers.reduce((sum, c) => sum + (c.balance_cents || 0), 0) / customers.length / 100
                : 0
            ).toFixed(2)}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            Per customer
          </p>
        </div>
      </div>
      
      <ArTabsTable initialCustomers={customers} />
    </div>
  );
}