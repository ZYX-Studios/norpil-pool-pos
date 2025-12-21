# Kitchen Display System (KDS) Architecture

## Overview
The KDS (Kitchen Display System) is a real-time dashboard used by kitchen staff to view and manage incoming orders. It replaces traditional paper tickets.

**Location**: `/kitchen`
**Access**: Accessible to authenticated staff (Waiters, Admin, etc.).

## Core Components

### `KitchenPage` (`app/kitchen/page.tsx`)
- The main entry point.
- Protected route: Redirects unauthenticated users to login.
- Renders the `KitchenBoard` client component.

### `KitchenBoard` (`app/pos/components/KitchenBoard.tsx`)
- **Type**: Client Component (`"use client"`)
- **State Management**: Uses `useState` to hold the list of `orders`.
- **Real-time Updates**: Subscribes to Supabase Realtime changes on `orders` and `order_items` tables to auto-refresh data.

## Data Flow & Query Logic

The KDS fetches orders directly from Supabase client-side.

### 1. Fetching Orders
It queries the `orders` table with deep joins to related data:
- `profiles` (for owner name)
- `table_session` -> `pool_table` (for table name)
- `order_items` -> `products` (for item details)

**Query Criteria**:
- Status is one of: `SUBMITTED`, `PREPARING`, `READY`, `PAID`.
- OR Status is `OPEN` AND `order_type` is `MOBILE` (for mobile orders).
- Sorted by `sent_at` (submission time) or fallback to `created_at`.

### 2. Filtering Logic (Client-Side)
- **Table Time**: Items with category `TABLE_TIME` are filtered out.
- **Served Quantities**: Only displays items where `quantity > served_quantity`.
- **Empty Orders**: Orders with no displayable items (e.g., only table time) are hidden.

### 3. Status Workflow
The Kanban board moves orders through statuses:
1. **New Orders**: `SUBMITTED`, `PAID`, `OPEN` (Mobile). Action: "Start Prep" -> `PREPARING`.
2. **Preparing**: `PREPARING`. Action: "Mark Ready" -> `READY`.
3. **Ready for Pickup**: `READY`. Action: "Complete" -> `SERVED`.

When an order is marked `SERVED`:
- It calls the server action `markOrderServedAction`.
- This updates `served_quantity` for all items to match `quantity`.
- Sets order status to `SERVED`.

## Common Issues & Troubleshooting

### "Ambiguous Foreign Key" Error (PGRST201)
**Symptoms**: KDS shows "Connecting..." but no orders load. Console shows `PGRST201` error.
**Cause**: The `table_sessions` table has multiple relationships to `pool_tables` (e.g., `pool_table_id` and `released_from_table_id`). Supabase cannot auto-detect which Foreign Key to use for the join.
**Fix**: Explicitly specify the FK in the query:
```typescript
table_session:table_sessions(
    customer_name,
    pool_table:pool_tables!table_sessions_pool_table_id_fkey(name)
)
```

### Missing Orders
- Check if `order_items` exist. Empty orders are filtered client-side.
- Check if items are `TABLE_TIME`. These are hidden by default.
- Check Realtime subscription status (green indicator in UI).
