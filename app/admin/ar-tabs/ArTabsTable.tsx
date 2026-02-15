'use client';

import { useState } from "react";
import { CustomerBalance } from "@/lib/types/database";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

interface ArTabsTableProps {
  initialCustomers: CustomerBalance[];
}

export function ArTabsTable({ initialCustomers }: ArTabsTableProps) {
  const [customers, setCustomers] = useState(initialCustomers);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortField, setSortField] = useState<'name' | 'balance' | 'last_transaction'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const filteredCustomers = customers.filter(customer => {
    // Search filter
    const matchesSearch = customer.name.toLowerCase().includes(search.toLowerCase()) ||
                         customer.id.includes(search);
    
    // Status filter
    const matchesStatus = statusFilter === 'all' || customer.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const sortedCustomers = [...filteredCustomers].sort((a, b) => {
    let aValue: any, bValue: any;
    
    switch (sortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'balance':
        aValue = a.balance_cents || 0;
        bValue = b.balance_cents || 0;
        break;
      case 'last_transaction':
        aValue = a.last_transaction_date ? new Date(a.last_transaction_date).getTime() : 0;
        bValue = b.last_transaction_date ? new Date(b.last_transaction_date).getTime() : 0;
        break;
    }
    
    if (sortDirection === 'asc') {
      return aValue > bValue ? 1 : -1;
    } else {
      return aValue < bValue ? 1 : -1;
    }
  });

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">Active</span>;
      case 'inactive':
        return <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-medium">Inactive</span>;
      default:
        return null;
    }
  };

  const getBalanceColor = (balance: number) => {
    if (balance > 0) {
      return "text-red-600 font-semibold";
    } else if (balance < 0) {
      return "text-green-600 font-semibold";
    }
    return "text-gray-600";
  };

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Filters */}
      <div className="p-4 border-b">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full p-2 border rounded-lg"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="p-2 border rounded-lg"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
            <Link
              href="/admin/ar-tabs/new"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              New Customer
            </Link>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="p-4 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-2">
                  Customer
                  {sortField === 'name' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="p-4 text-left">Status</th>
              <th 
                className="p-4 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('balance')}
              >
                <div className="flex items-center gap-2">
                  Balance
                  {sortField === 'balance' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="p-4 text-left">Credit Limit</th>
              <th 
                className="p-4 text-left cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('last_transaction')}
              >
                <div className="flex items-center gap-2">
                  Last Transaction
                  {sortField === 'last_transaction' && (
                    <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                  )}
                </div>
              </th>
              <th className="p-4 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedCustomers.map((customer) => (
              <tr key={customer.id} className="border-t hover:bg-gray-50">
                <td className="p-4">
                  <div>
                    <div className="font-medium">{customer.name}</div>
                    <div className="text-sm text-gray-500">{customer.id.substring(0, 8)}...</div>
                  </div>
                </td>
                <td className="p-4">
                  {getStatusBadge(customer.status)}
                </td>
                <td className="p-4">
                  <div className={getBalanceColor(customer.balance_cents || 0)}>
                    {formatCurrency((customer.balance_cents || 0) / 100)}
                  </div>
                  <div className="text-sm text-gray-500">
                    {customer.transaction_count || 0} transaction{customer.transaction_count !== 1 ? 's' : ''}
                  </div>
                </td>
                <td className="p-4">
                  {customer.credit_limit_cents > 0 ? (
                    <div>
                      <div>{formatCurrency(customer.credit_limit_cents / 100)}</div>
                      <div className="text-sm text-gray-500">
                        {customer.credit_limit_cents > 0 && customer.balance_cents 
                          ? `${Math.round((customer.balance_cents / customer.credit_limit_cents) * 100)}% used`
                          : 'No limit'
                        }
                      </div>
                    </div>
                  ) : (
                    <span className="text-gray-500">No limit</span>
                  )}
                </td>
                <td className="p-4">
                  {customer.last_transaction_date ? (
                    new Date(customer.last_transaction_date).toLocaleDateString()
                  ) : (
                    <span className="text-gray-500">Never</span>
                  )}
                </td>
                <td className="p-4">
                  <div className="flex gap-2">
                    <Link
                      href={`/admin/ar-tabs/${customer.id}`}
                      className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
                    >
                      View
                    </Link>
                    <Link
                      href={`/admin/ar-tabs/${customer.id}/charge`}
                      className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 rounded"
                    >
                      Charge
                    </Link>
                    <Link
                      href={`/admin/ar-tabs/${customer.id}/payment`}
                      className="px-3 py-1 text-sm bg-green-100 text-green-700 hover:bg-green-200 rounded"
                    >
                      Payment
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {sortedCustomers.length === 0 && (
          <div className="p-8 text-center text-gray-500">
            No customers found. {search && "Try a different search term."}
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="p-4 border-t bg-gray-50">
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-600">
            Showing {sortedCustomers.length} of {customers.length} customer{sortedCustomers.length !== 1 ? 's' : ''}
          </div>
          <div className="text-sm font-medium">
            Total Balance:{" "}
            <span className={getBalanceColor(
              sortedCustomers.reduce((sum, c) => sum + (c.balance_cents || 0), 0)
            )}>
              {formatCurrency(
                sortedCustomers.reduce((sum, c) => sum + (c.balance_cents || 0), 0) / 100
              )}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}