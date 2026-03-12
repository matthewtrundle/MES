# Section 6: Inventory Management -- Gap Analysis

## Source Spec Lines: 386-456

## Summary

The codebase has solid foundations for inventory tracking (on-hand, committed, available calculations), low-stock alerts, expiry tracking, and FIFO lot ordering. However, it is missing several spec requirements: the full inventory record fields (part number/revision, storage location hierarchy, inspection status beyond simple status, reservation status), an immutable InventoryTransaction ledger model, buildable-units calculation, replenishment/demand forecasting with rolling windows and reorder triggers, and authorized FIFO override with justification.

---

## 6.1 Inventory Record

### REQ-6.1.1: Part number/revision on inventory record
- **Status**: GAP
- **Spec**: Inventory record includes part number/revision
- **Current**: `MaterialLot` has `materialCode` (string) which loosely maps to part number, but there is no `revision` field on MaterialLot or any related model. `materialCode` is a free-text string with no link to a formal part master.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (line 298)
- **Gap**: No `revision` field. No formal PartMaster entity linking material codes to part numbers with revisions.

### REQ-6.1.2: Lot number
- **Status**: IMPLEMENTED
- **Spec**: Lot number on inventory record
- **Current**: `MaterialLot.lotNumber` is a unique string field.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (line 297)

### REQ-6.1.3: Quantity on hand
- **Status**: IMPLEMENTED
- **Spec**: Qty on hand tracked
- **Current**: `MaterialLot.qtyRemaining` tracks remaining quantity per lot. `getInventorySummary()` aggregates across lots by material code.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 9-90)

### REQ-6.1.4: Storage location (bin/shelf/rack hierarchy)
- **Status**: GAP
- **Spec**: Storage location with bin/shelf/rack hierarchy
- **Current**: No storage location, bin, shelf, or rack fields exist on `MaterialLot` or any other model. There is no location hierarchy model.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (lines 295-319)

### REQ-6.1.5: Date received
- **Status**: IMPLEMENTED
- **Spec**: Date received on inventory record
- **Current**: `MaterialLot.receivedAt` with `@default(now())`.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (line 307)

### REQ-6.1.6: Inspection status (Pending IQC / Conforming / Nonconforming / Quarantine)
- **Status**: PARTIAL
- **Spec**: Inspection status with values: Pending IQC, Conforming, Nonconforming, Quarantine
- **Current**: `MaterialLot.status` supports values: `available`, `quarantine`, `expired`, `depleted`. The receiving form allows setting `available` or `quarantine` on receipt. There is no `Pending IQC`, `Conforming`, or `Nonconforming` status. No IQC workflow integration.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (line 305), `/Users/matthewrundle/Documents/MES-local/src/lib/actions/material-receiving.ts` (line 19)
- **Gap**: Missing `pending_iqc`, `conforming`, `nonconforming` statuses. No IQC workflow to transition status after incoming inspection.

### REQ-6.1.7: Reservation status (Available / Reserved for WO)
- **Status**: PARTIAL
- **Spec**: Reservation status: Available / Reserved for WO
- **Current**: Reservation is implicitly tracked through the kitting system (Kit/KitLine models). When a kit line is picked, quantity is decremented from `qtyRemaining`. The inventory summary calculates `committed` from active kit lines. However, there is no explicit `reservationStatus` field on MaterialLot, and the reservation is not linked to a specific work order at the lot level.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 27-87), `/Users/matthewrundle/Documents/MES-local/src/lib/actions/kitting.ts` (lines 137-153)
- **Gap**: No explicit reservation status field. Reservation is implicit via kitting. Cannot query "which WO is this lot reserved for?" directly from the lot.

---

## 6.2 Inventory Transactions

### REQ-6.2.1: Immutable transaction ledger with timestamp/user/reason code
- **Status**: GAP
- **Spec**: Immutable inventory transactions with timestamp, user, reason code
- **Current**: No `InventoryTransaction` model exists. Inventory changes are tracked through multiple mechanisms:
  - Receiving: creates a new `MaterialLot` record (not a transaction)
  - Consumption: creates `UnitMaterialConsumption` records
  - Adjustment: creates `AuditLog` entries and emits events
  - Kitting: updates `KitLine` and decrements `MaterialLot.qtyRemaining`
  There is no unified, immutable transaction ledger. No reason code taxonomy.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (no InventoryTransaction model), `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory-adjustment.ts`

### REQ-6.2.2: Transaction type -- Receive
- **Status**: PARTIAL
- **Spec**: Receive transaction type
- **Current**: `receiveMaterialLot()` creates a MaterialLot and emits a `material_lot_received` event. But this is not recorded as an inventory transaction in a dedicated ledger.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/material-receiving.ts` (lines 30-85)

### REQ-6.2.3: Transaction type -- Issue to WO
- **Status**: PARTIAL
- **Spec**: Issue to WO transaction type
- **Current**: Kit issuance (`issueKit()`) marks a kit as issued and emits an event. Material consumption (`consumeMaterial()`) creates `UnitMaterialConsumption` records. Neither creates a formal "Issue to WO" inventory transaction.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/kitting.ts` (lines 183-234), `/Users/matthewrundle/Documents/MES-local/src/lib/actions/materials.ts` (lines 82-216)

### REQ-6.2.4: Transaction type -- Return from WO
- **Status**: GAP
- **Spec**: Return from WO transaction type
- **Current**: No return-from-WO functionality exists. Material consumption is one-way; there is no mechanism to reverse or return material.

### REQ-6.2.5: Transaction type -- Scrap
- **Status**: GAP
- **Spec**: Scrap transaction type
- **Current**: No scrap transaction for inventory. While NCR disposition can result in scrap, there is no inventory scrap transaction that adjusts lot quantities with a scrap reason.

### REQ-6.2.6: Transaction type -- Adjustment (mandatory note)
- **Status**: IMPLEMENTED
- **Spec**: Adjustment with mandatory note/reason
- **Current**: `adjustInventory()` requires a `reason` field (validated as min 1 char), creates an audit log entry, and emits an event. The adjustment updates `qtyRemaining` directly on the lot.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory-adjustment.ts` (lines 10-82)

### REQ-6.2.7: Transaction type -- Transfer between locations
- **Status**: GAP
- **Spec**: Transfer between storage locations
- **Current**: No storage locations exist (see REQ-6.1.4), so transfers are impossible.

---

## 6.3 Inventory Dashboard

### REQ-6.3.1: All parts current qty (on hand, on order, reserved, available)
- **Status**: PARTIAL
- **Spec**: Dashboard showing on hand, on order, reserved, available for all parts
- **Current**: The inventory dashboard shows: on-hand, committed (reserved in kits), and available (on-hand minus committed). There is no "on order" quantity -- no purchase order tracking or integration to show incoming quantities.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/app/dashboard/inventory/page.tsx` (lines 36-148)
- **Gap**: Missing "on order" quantity. No PO integration for inbound visibility.

### REQ-6.3.2: Low stock alerts
- **Status**: IMPLEMENTED
- **Spec**: Low stock alerts on dashboard
- **Current**: `getLowStockMaterials()` calculates daily consumption rate from 30-day history and flags materials projected to run out within a threshold (default 7 days on dashboard). Displayed with urgency badges (Critical/Warning/Low).
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 111-169), `/Users/matthewrundle/Documents/MES-local/src/app/dashboard/inventory/page.tsx` (lines 216-279)

### REQ-6.3.3: Stockout risk
- **Status**: PARTIAL
- **Spec**: Stockout risk indicator
- **Current**: Low stock detection with days-remaining calculation provides implicit stockout risk. The urgency badges (Critical at <=2 days, Warning at <=5 days) serve as stockout risk indicators. However, there is no explicit "stockout risk" metric or scoring model.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/app/dashboard/inventory/page.tsx` (lines 261-271)

### REQ-6.3.4: Slow-moving inventory
- **Status**: GAP
- **Spec**: Slow-moving inventory identification
- **Current**: No slow-moving inventory analysis. No metrics for identifying materials with low turnover or excessive stock relative to consumption.

### REQ-6.3.5: Expiry tracking for adhesives/chemicals
- **Status**: IMPLEMENTED
- **Spec**: Expiry tracking for adhesives/chemicals
- **Current**: `MaterialLot.expiresAt` field supports expiry dates. `getExpiringLots()` identifies lots expiring within a configurable window. Dashboard section shows expiring lots with countdown badges. Material consumption blocks expired lots.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 174-193), `/Users/matthewrundle/Documents/MES-local/src/app/dashboard/inventory/page.tsx` (lines 281-368), `/Users/matthewrundle/Documents/MES-local/src/lib/actions/materials.ts` (lines 159-161)

---

## 6.4 Buildable Units Calculation

### REQ-6.4.1: Per motor model, how many units buildable from available unreserved inventory
- **Status**: GAP
- **Spec**: Calculate buildable units per motor model from available unreserved inventory using current BOM
- **Current**: No buildable-units calculation exists. The BOM (`BillOfMaterial` model) and available inventory data are both present, but no function combines them to compute buildable units.
- **Files**: `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` (lines 138-153 -- BillOfMaterial model)

### REQ-6.4.2: Identify limiting component
- **Status**: GAP
- **Spec**: Identify the limiting (constraining) component for buildable units
- **Current**: Not implemented. Would require comparing available qty / qty-per-unit for each BOM line and finding the minimum.

### REQ-6.4.3: Display prominently
- **Status**: GAP
- **Spec**: Buildable units displayed prominently on dashboard
- **Current**: Not implemented. No UI element for buildable units.

### REQ-6.4.4: Recalculate in real time
- **Status**: GAP
- **Spec**: Buildable units recalculated in real time
- **Current**: Not implemented. The dashboard does auto-refresh every 30 seconds via `AutoRefresh` component, which would support near-real-time recalculation if the buildable units function were added.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/app/dashboard/inventory/page.tsx` (line 81)

---

## 6.5 Replenishment & Demand Forecasting

### REQ-6.5.1: Consumption rate (rolling 30/60/90 day)
- **Status**: PARTIAL
- **Spec**: Consumption rate calculated over rolling 30, 60, and 90 day windows
- **Current**: `getLowStockMaterials()` calculates consumption rate using a fixed 30-day lookback. No 60-day or 90-day windows. No configurable rolling period.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 114-136)
- **Gap**: Only 30-day window. Missing 60-day and 90-day calculations.

### REQ-6.5.2: Days of stock remaining
- **Status**: IMPLEMENTED
- **Spec**: Days of stock remaining per material
- **Current**: Calculated as `currentQty / dailyRate` in `getLowStockMaterials()`. Displayed on dashboard as "Days Remaining" column.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/inventory.ts` (lines 156-157)

### REQ-6.5.3: Reorder trigger (days remaining < lead time + safety buffer)
- **Status**: GAP
- **Spec**: Reorder trigger when days remaining < lead time + safety buffer
- **Current**: No lead time or safety buffer fields on any model. No reorder trigger logic. Low stock alert uses a simple days threshold, not a lead-time-based calculation.

### REQ-6.5.4: Suggested order qty
- **Status**: GAP
- **Spec**: System suggests order quantity for replenishment
- **Current**: Not implemented. No suggested order quantity calculation.

### REQ-6.5.5: Production forecast from planned WOs
- **Status**: GAP
- **Spec**: Demand forecasting from planned work orders
- **Current**: No forward-looking demand calculation based on pending/planned work orders and their BOMs.

### REQ-6.5.6: Surface recommendations (no auto-ordering)
- **Status**: GAP
- **Spec**: Surface replenishment recommendations without auto-ordering
- **Current**: Low stock alerts exist but are not formatted as actionable replenishment recommendations with suggested quantities, suppliers, or lead times.

---

## 6.6 FIFO and Lot Control

### REQ-6.6.1: Enforce FIFO by default
- **Status**: IMPLEMENTED
- **Spec**: FIFO enforcement by default for lot selection
- **Current**: `getAvailableMaterialLots()` orders lots by `receivedAt: 'asc'` (FIFO). The `MaterialConsumptionDialog` UI sorts lots by FIFO and labels them "Sorted by FIFO (oldest first)". The simulation tick route also uses FIFO ordering.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/materials.ts` (line 23), `/Users/matthewrundle/Documents/MES-local/src/components/operator/MaterialConsumptionDialog.tsx` (line 82)

### REQ-6.6.2: Allow authorized FIFO override with documented justification
- **Status**: PARTIAL
- **Spec**: Authorized override of FIFO with documented justification
- **Current**: Operators can select any lot from the list (not just the oldest), so FIFO is a soft default, not enforced. However, there is no explicit "override FIFO" workflow that requires authorization or justification. No audit trail for out-of-order lot selection.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/components/operator/MaterialConsumptionDialog.tsx`
- **Gap**: No FIFO override authorization check. No justification field or audit record when a non-FIFO lot is selected.

### REQ-6.6.3: Preserve lot traceability
- **Status**: IMPLEMENTED
- **Spec**: Full lot traceability maintained
- **Current**: `UnitMaterialConsumption` links units to material lots with operator, station, and timestamp. `getUnitMaterials()` provides forward traceability (unit -> lots). `getUnitsFromLot()` provides reverse traceability (lot -> units). `searchMaterialLot()` provides lot lookup with consumption history.
- **Files**: `/Users/matthewrundle/Documents/MES-local/src/lib/actions/materials.ts` (lines 221-279)

---

## Requirement Counts

| Status | Count |
|--------|-------|
| IMPLEMENTED | 9 |
| PARTIAL | 6 |
| GAP | 12 |
| **Total** | **27** |

## Priority Gaps (Recommended Implementation Order)

1. **Immutable InventoryTransaction ledger** (REQ-6.2.1) -- Foundation for all transaction types; currently fragmented across multiple mechanisms.
2. **Buildable units calculation** (REQ-6.4.1-6.4.4) -- High business value; BOM and inventory data already exist. Requires a new server action combining BOM with available inventory.
3. **Storage location hierarchy** (REQ-6.1.4) -- Needed for Transfer transactions and warehouse operations.
4. **Inspection status expansion** (REQ-6.1.6) -- Needed for IQC workflow integration (see Section 4).
5. **FIFO override with justification** (REQ-6.6.2) -- Compliance requirement; currently FIFO is not enforced, just defaulted.
6. **Replenishment recommendations** (REQ-6.5.3-6.5.6) -- Business value for procurement; depends on lead time data.
7. **Return from WO / Scrap transactions** (REQ-6.2.4-6.2.5) -- Needed for complete inventory lifecycle.
8. **Slow-moving inventory** (REQ-6.3.4) -- Lower priority; useful for inventory optimization.
