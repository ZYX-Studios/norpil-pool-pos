# Database Documentation

This document provides a detailed overview of the database schema for the application. The database is hosted on Supabase and uses PostgreSQL.

## Tables

### `action_logs`
Logs user actions and system events.
- `id` (uuid): Primary key.
- `user_id` (uuid): ID of the user performing the action.
- `action_type` (text): Type of action (e.g., 'LOGIN', 'CREATE_ORDER').
- `entity_type` (text): The entity affected (e.g., 'order', 'product').
- `entity_id` (text): ID of the affected entity.
- `details` (jsonb): Additional details about the action.
- `ip_address` (text): IP address of the user.
- `user_agent` (text): User agent string.
- `created_at` (timestamptz): Timestamp of the action.

### `app_settings`
Stores global application settings.
- `key` (text): Primary key, setting name.
- `value` (text): Setting value.
- `description` (text): Description of the setting.
- `updated_at` (timestamptz): Last update timestamp.

### `cashier_shifts`
Tracks cashier shifts for cash management.
- `id` (uuid): Primary key.
- `staff_id` (uuid): ID of the staff member.
- `started_at` (timestamptz): Shift start time.
- `ended_at` (timestamptz): Shift end time.
- `starting_cash` (numeric): Cash amount at start.
- `expected_cash` (numeric): Calculated expected cash at end.
- `actual_cash` (numeric): Actual cash counted at end.
- `difference` (numeric): Discrepancy between expected and actual cash.
- `notes` (text): Optional notes.
- `created_by` (uuid): User who created the shift record.

### `expenses`
Records business expenses.
- `id` (uuid): Primary key.
- [Additional columns based on standard expense tracking]

### `inventory_item_stock`
Tracks stock levels for inventory items.
- `id` (uuid): Primary key.
- [Additional columns for stock management]

### `inventory_items`
Definitions of raw inventory items (ingredients).
- `id` (uuid): Primary key.
- [Additional columns for item details]

### `inventory_movements`
Logs changes in inventory stock.
- `id` (uuid): Primary key.
- [Additional columns for movement tracking]

### `order_items`
Items included in a specific order.
- `id` (uuid): Primary key.
- `order_id` (uuid): Foreign key to `orders`.
- `product_id` (uuid): Foreign key to `products`.
- `quantity` (integer): Number of items ordered.
- `price` (numeric): Unit price at time of order.
- `status` (text): Status of the item (e.g., 'PENDING', 'SERVED').

### `orders`
Customer orders.
- `id` (uuid): Primary key.
- `table_id` (uuid): Optional link to a `pool_tables`.
- `status` (text): Order status (e.g., 'OPEN', 'CLOSED').
- `total_amount` (numeric): Total cost of the order.
- `created_at` (timestamptz): Order creation time.
- `user_id` (uuid): User who created the order.

### `payment_codes`
Codes used for wallet payments or redemptions.
- `id` (uuid): Primary key.
- `code` (text): The actual code string.
- `user_id` (uuid): Linked user, if any.
- `status` (text): Status of the code.

### `payments`
Records of payments received.
- `id` (uuid): Primary key.
- `order_id` (uuid): Linked order.
- `amount` (numeric): Payment amount.
- `method` (text): Payment method (e.g., 'CASH', 'WALLET').
- `created_at` (timestamptz): Payment timestamp.

### `pool_tables`
Manages pool tables for rental.
- `id` (uuid): Primary key.
- `name` (text): Table name/number.
- `is_active` (boolean): Availability status.
- `hourly_rate` (numeric): Cost per hour.
- `deleted_at` (timestamptz): Soft delete timestamp.

### `product_inventory_recipes`
Links products to inventory items for stock deduction.
- `id` (uuid): Primary key.
- `product_id` (uuid): Linked product.
- `inventory_item_id` (uuid): Linked ingredient.
- `quantity` (numeric): Amount used per product unit.

### `product_stock`
Tracks immediate stock of products (if not composable).
- `id` (uuid): Primary key.
- `product_id` (uuid): Linked product.
- `quantity` (numeric): Current stock level.

### `products`
Items available for sale.
- `id` (uuid): Primary key.
- `name` (text): Product name.
- `price` (numeric): Selling price.
- `category` (text): Product category.
- `is_available` (boolean): Availability status.

### `profiles`
User profiles extending auth.users.
- `id` (uuid): Primary key, matches auth.users.id.
- `full_name` (text): User's full name.
- `role` (text): User role in the system.

### `reservations`
Table reservations.
- `id` (uuid): Primary key.
- `pool_table_id` (uuid): Reserved table.
- `start_time` (timestamptz): Reservation start.
- `end_time` (timestamptz): Reservation end.
- `customer_name` (text): Name of the customer.

### `staff`
Staff details and roles.
- `id` (uuid): Primary key.
- `user_id` (uuid): Link to auth.users.
- `name` (text): Staff name.
- `role` (USER-DEFINED): Enum 'ADMIN', 'CASHIER', 'WAITER'.

### `table_sessions`
Active sessions for pool tables.
- `id` (uuid): Primary key.
- `pool_table_id` (uuid): Linked table.
- `start_time` (timestamptz): Session start.
- `end_time` (timestamptz): Session end.
- `open_by` (uuid): Staff who opened the table.
- `closed_by` (uuid): Staff who closed the table.

### `wallet_transactions`
History of wallet balance changes.
- `id` (uuid): Primary key.
- `wallet_id` (uuid): Linked wallet.
- `amount` (numeric): Transaction amount.
- `type` (USER-DEFINED): Transaction type.
- `description` (text): Transaction details.

### `wallets`
User digital wallets.
- `id` (uuid): Primary key.
- `profile_id` (uuid): Owner of the wallet.
- `balance` (numeric): Current balance.
- `updated_at` (timestamptz): Last update.
