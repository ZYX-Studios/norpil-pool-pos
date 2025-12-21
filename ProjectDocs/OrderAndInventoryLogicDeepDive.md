# Deep Dive: Order Finality & Inventory Logic

**Date:** 2025-12-21
**Prepared For:** Master Rob

## Executive Summary
After a triple-check investigation including Codebase, Database Triggers, View Definitions, and Edge Functions, we can confirm with **100% certainty**: 
**Inventory deduction is currently NOT implemented.**

## 1. Inventory Logic Analysis (Re-Verified)
**The "Product Stock" you see is a Read-Only View.**
-   `product_stock` is a dynamic view that calculates `quantity_on_hand` by looking at `inventory_item_stock` (ingredients) and `product_inventory_recipes`.
-   **THE MISSING LINK:** There is **NO CODE** and **NO TRIGGER** anywhere in the system that updates the `inventory_item_stock` table when a sale happens in the POS.
-   We checked:
    -   `actions.ts` (POS logic): No updates to inventory.
    -   `KitchenBoard.tsx`: No updates to inventory.
    -   Database Triggers: No triggers on `orders` or `order_items` that touch inventory.
    -   Edge Functions: None exist.

**Conclusion:** The system is *designed* for inventory tracking (via recipes), but the *execution* (deducting stock on sale) was never built or was removed.

## 2. Order Finality (Re-Confirmed)
-   **Locked:** You cannot delete minimal "Orders" (the bill wrapper) after sending.
-   **Open:** You CAN delete "Items" (dishes) after sending, as long as they aren't "Served". This is the "gap" you are experiencing.

## 3. The Plan to Fix It ("Tightening Up")
To achieve your goal of Strict Logic + Working Inventory, we must implement:

1.  **Strict "Commited" State:**
    -   Items sent to the kitchen (`SUBMITTED`) become **LOCKED**.
    -   The "-" button will be disabled for these items.

2.  **Explicit "Void" Action:**
    -   To remove a locked item, you must use a new **"Void"** button.
    -   This logs the action as a "VOID" (useful for tracking waste/mistakes) instead of just deleting it.

3.  **Real Inventory Deduction:**
    -   We will create a database trigger.
    -   **On Send (SUBMITTED):** The trigger will look up the recipe for each item and deduct the correct amount from `inventory_item_stock`.
    -   **On Void:** The trigger will add the stock back (optional but recommended) or log it as waste.

## Next Steps
We strongly recommend proceeding with the **Implementation Plan** to build these missing features.
