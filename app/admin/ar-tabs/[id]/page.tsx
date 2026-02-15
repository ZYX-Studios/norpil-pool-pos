import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCustomerLedger } from "@/app/ar-tabs/actions";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

interface CustomerDetailPageProps {
  params: {
    id: string;
  };
}

export default async function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const supabase = createSupabaseServerClient();
  
  // Get customer details
  const { data: customer, error } = await supabase
    .from('customer_balances')
    .select('*')
    .eq('id', params.id)
    .single();
  
  if (error || !customer) {
    notFound();
  }
  
  // Get ledger entries
  const ledgerEntries = await getCustomerLedger(params.id);
  
  const balance = customer.balance_cents || 0;
  const creditLimit = customer.credit_limit_cents || 0;
  const usagePercent = creditLimit > 0 ? Math.round((balance / creditLimit) * 100) : 0;
  
  return (
    <div className="p-6">
      <div className="mb-6">
        <Link 
          href="/admin/ar-tabs"
          className="text-blue-600 hover:text-blue-800"
        >
          ← Back to AR Tabs
        </Link>
      </div>
      
      {/* Customer Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold">{customer.name}</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                customer.status === 'active' 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {customer.status === 'active' ? 'Active' : 'Inactive'}
              </span>
              <span className="text-gray-600">
                Customer since {new Date(customer.created_at).toLocaleDateString()}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-3xl font-bold mb-1">
              {formatCurrency(balance / 100)}
            </div>
            <div className="text-gray-600">Current Balance</div>
          </div>
        </div>
        
        {/* Credit Limit Info */}
        {creditLimit > 0 && (
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <div>
                <div className="font-medium">Credit Limit</div>
                <div className="text-2xl font-bold">{formatCurrency(creditLimit / 100)}</div>
              </div>
              <div className="text-right">
                <div className="font-medium">Usage</div>
                <div className="text-2xl font-bold">{usagePercent}%</div>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div 
                className={`h-2.5 rounded-full ${
                  usagePercent > 90 ? 'bg-red-600' :
                  usagePercent > 75 ? 'bg-yellow-500' :
                  'bg-green-600'
                }`}
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              ></div>
            </div>
            <div className="text-sm text-gray-600 mt-2">
              {balance > 0 
                ? `${formatCurrency((creditLimit - balance) / 100)} available`
                : 'No balance owed'
              }
            </div>
          </div>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-3 mt-6">
          <Link
            href={`/admin/ar-tabs/${params.id}/charge`}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Charge to Tab
          </Link>
          <Link
            href={`/admin/ar-tabs/${params.id}/payment`}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Record Payment
          </Link>
          <Link
            href={`/admin/ar-tabs/${params.id}/edit`}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Edit Customer
          </Link>
        </div>
      </div>
      
      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Transaction History</h2>
          <p className="text-gray-600 mt-1">
            {ledgerEntries.length} transaction{ledgerEntries.length !== 1 ? 's' : ''} total
          </p>
        </div>
        
        {ledgerEntries.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-4 text-left">Date & Time</th>
                  <th className="p-4 text-left">Type</th>
                  <th className="p-4 text-left">Amount</th>
                  <th className="p-4 text-left">Staff</th>
                  <th className="p-4 text-left">Session</th>
                  <th className="p-4 text-left">ID</th>
                </tr>
              </thead>
              <tbody>
                {ledgerEntries.map((entry: any) => (
                  <tr key={entry.id} className="border-t hover:bg-gray-50">
                    <td className="p-4">
                      {new Date(entry.created_at).toLocaleString()}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        entry.type === 'CHARGE' ? 'bg-red-100 text-red-800' :
                        entry.type === 'PAYMENT' ? 'bg-green-100 text-green-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {entry.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium">
                      {entry.type === 'CHARGE' ? '+' : '-'}
                      {formatCurrency(entry.amount_cents / 100)}
                    </td>
                    <td className="p-4">
                      {entry.staff?.name || 'Unknown'}
                    </td>
                    <td className="p-4">
                      {entry.pos_session_id ? (
                        <Link
                          href={`/pos/${entry.pos_session_id}`}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          View Session
                        </Link>
                      ) : (
                        <span className="text-gray-500">—</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="text-sm text-gray-500 font-mono">
                        {entry.id.substring(0, 8)}...
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            No transactions yet. Charges and payments will appear here.
          </div>
        )}
      </div>
    </div>
  );
}