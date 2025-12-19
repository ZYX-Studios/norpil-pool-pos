# Application Overview

## Introduction
The Norpil Billiards POS is a comprehensive Point of Sale and management system designed for a pool hall. It handles order management, table time tracking, inventory, staff shifts, and customer engagement.

## Application Modules

### 1. POS (Point of Sale) (`/app/pos`)
The core interface for day-to-day operations.
- **Session Management**: Handle active table sessions, tracking time and calculating costs.
- **Ordering**: Create orders for food, drinks, and other products.
- **Checkout**: Process payments via Cash, Wallet, or other methods.
- **Structure**:
  - `[sessionId]/`: Dynamic route for specific table/order sessions.
  - `components/`: UI components specific to the POS view.

### 2. Admin Dashboard (`/app/admin`)
The backend management area for owners and managers.
- **Reporting**: View sales, inventory, and shift reports.
- **User Management**: Manage staff roles and permissions.
- **Product Management**: Add or edit products and categories.
- **Settings**: Configure application-wide settings.
- **Structure**:
  - `customers/`: Customer management.
  - `inventory/`: Inventory tracking and stock management.
  - `products/`: Product catalog management.
  - `reports/`: Financial and operational reports.
  - `staff/`: Staff scheduling and management.

### 3. Kitchen Display (`/app/kitchen`)
Interface for kitchen staff to view and process food orders.

### 4. Public/Client View
Mobile-friendly interface for customers to view their profile, wallet balance, and potentially order.

## Directory Structure
- `app/`: Next.js App Router source code.
- `components/`: Shared UI components used across the app (e.g., buttons, modals).
- `lib/`: Utility functions, database clients, and helper classes.
- `supabase/`: Database migrations and configuration.
- `public/`: Static assets like images and icons.

## Key Features
- **Table Timer**: Automatic calculation of table fees based on duration and hourly rates.
- **Wallet System**: Digital wallet for frequent customers, supporting deposits and payments.
- **Inventory Tracking**: Recipe-based inventory deduction when products are sold.
- **Role-Based Access**: Distinct permissions for Admins, Cashiers, and Waiters.
