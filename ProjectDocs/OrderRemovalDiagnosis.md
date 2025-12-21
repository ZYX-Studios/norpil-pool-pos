# Order Removal Diagnosis: Walk-in "Digs"

**Date:** 2025-12-21
**Investigated By:** AI Agent

## Issue Description
The user reported an inability to remove the "Longsilog (Sweet)" order item for a walk-in customer named "Digs", stating that the order had not been sent to the kitchen yet.

## Findings

### 1. Session and Order State
- **Session:** Walk-in "Digs" (ID: `8500df10-4b17-483c-a901-98a383038af4`)
- **Status:** OPEN.
- **Active Order:** `826b0be2-126e-4786-8af4-f2be3cfc8965`.
- **Order Status:** `SUBMITTED`.
- **Sent At:** `2025-12-21 12:20:43.248+00`.

### 2. Item Timeline
The order contains 3 items. The item in question is **Longsilog (Sweet)**.

| Item | Created At | Sent At | Status |
| :--- | :--- | :--- | :--- |
| Item A (Others) | 12:09:05 | - | - |
| **Longsilog (Sweet)** | **12:20:39** | **12:20:43** | Submitted (Created before Send) |
| Mineral | 12:20:49 | - | Not Submitted (Created after Send) |

**Conclusion on Timeline:**
The "Longsilog (Sweet)" item was created at `12:20:39`, which is **4 seconds before** the order was marked as Sent (`12:20:43`). Therefore, the system correctly considers this item as "Submitted" to the kitchen. This contradicts the user's observation that it was "never sent".

### 3. Removal Logic Analysis
The codebase (`SessionClient.tsx`) allows removal of items by reducing the quantity to 0, provided the item has not been **Served** (i.e., `served_quantity` < `quantity`).

- **Served Quantity in DB:** `0` for all items in this order.
- **Database Policies (RLS):** Policies are permissive (`true`) for authenticated users to delete order items.
- **Triggers:** A trigger `trg_lock_paid_order_items` exists but only enforces immutability if the order status is `PAID`. Since the status is `SUBMITTED`, this trigger does not block deletion.

### 4. Diagnosis
The system effectively "locked" the perception of the item as sent because the "Send" action occurred after the item was added.
- **Why it can't be removed:** 
    - Technically, the code **allows** removal since `served_quantity` is 0. 
    - If the user is clicking the `-` button and nothing is happening (or it's disabled), it suggests a client-side state issue where the UI might incorrectly believe `served_quantity` is non-zero, though database confirmation shows it is 0.
    - If the user receives an error "Failed to remove item", it would possibly be a network or specific RLS edge case, but standard checks show open permissions.

**Likely Root Cause of User Confusion:**
The user likely added the item and the order was sent (either by them or automatically if part of a batch) almost immediately (4 seconds later). The system considers it sent. However, since it hasn't been prepared ('served'), it should still be removable.

**Recommendation:**
1.  **Verification:** The user can try refreshing the page to ensure the client-side state matches the DB (where `served_quantity` is 0).
2.  **Fix:** If the issue persists, we should investigate if the `SessionClient` logic for `disabled={i.quantity <= i.servedQuantity}` is receiving the correct data.

## Next Steps
- Confirm if the user sees an error message or if the button is simply disabled.
- If the button is working but determining "Submitted" blocks it, we verify the `last_submitted_item_count` usage, though standard logic relies on `served_quantity`.
