# Section 7: Work Order Management — Gap Analysis

**Spec Reference:** SPEC.md lines 458-516
**Analysis Date:** 2026-03-12
**Analyst:** Claude Opus 4.6

---

## Summary

Work order management is the most mature area of the codebase. Core CRUD, release, completion, and cancellation flows are implemented with proper RBAC and event emission. Kitting is functional with BOM-driven kit generation, line-by-line picking, and kit issuance. However, several spec requirements are missing: customer fields, target start date, auto-inventory-reservation on creation, FIFO lot selection, shortage alerts, storage locations, subassembly kit distinction, production traveler document, and the full 9-state status model (only 5 of 9 statuses exist).

| Status | Count |
|--------|-------|
| IMPLEMENTED | 14 |
| PARTIAL | 10 |
| NOT_IMPLEMENTED | 13 |

---

## 7.1 Work Order Creation

### REQ-7.1.1: Motor model field linking to BOM
**Status:** IMPLEMENTED
**Evidence:** `WorkOrder` model in `prisma/schema.prisma` has `productCode`, `productName`, and `routingId` fields. The `routingId` links to the `Routing` model which in turn links to `BillOfMaterial` entries. `createWorkOrder()` in `src/lib/actions/work-orders.ts` (line 296) accepts `routingId` and auto-creates `WorkOrderOperation` records from the routing's operations JSON.

### REQ-7.1.2: Quantity field
**Status:** IMPLEMENTED
**Evidence:** `WorkOrder.qtyOrdered` (Int) field in schema. The create form in `src/app/admin/work-orders/page.tsx` (line 268) includes a quantity input. `createWorkOrder()` accepts and stores `qtyOrdered`.

### REQ-7.1.3: Target start date
**Status:** NOT_IMPLEMENTED
**Evidence:** The `WorkOrder` model has `dueDate` (target completion) but no `targetStartDate` or equivalent field. The create form only has a "Due Date" input.
**Gap:** Need to add a `targetStartDate` field to the schema and the creation form.

### REQ-7.1.4: Target completion date
**Status:** IMPLEMENTED
**Evidence:** `WorkOrder.dueDate` field exists in the schema. The create form in `src/app/admin/work-orders/page.tsx` (line 326) includes a "Due Date" date input. `createWorkOrder()` accepts `dueDate`.

### REQ-7.1.5: Customer name (optional)
**Status:** NOT_IMPLEMENTED
**Evidence:** No `customerName` or `customer` field exists on the `WorkOrder` model. No customer-related fields in the create form. Searched for "customer" across all `.ts`, `.tsx`, and `.prisma` files with zero results.
**Gap:** Need to add optional `customerName` field to `WorkOrder` schema and the creation form.

### REQ-7.1.6: Customer order reference (optional)
**Status:** NOT_IMPLEMENTED
**Evidence:** No `customerOrderRef` or similar field exists on the `WorkOrder` model.
**Gap:** Need to add optional `customerOrderRef` field to `WorkOrder` schema and the creation form.

### REQ-7.1.7: Priority field
**Status:** IMPLEMENTED
**Evidence:** `WorkOrder.priority` (Int, default 0) exists in the schema. The create form includes a priority input (line 279). Work orders are sorted by priority descending in `getWorkOrders()` and `getStationWorkOrders()`. The dashboard displays priority badges.

### REQ-7.1.8: Notes field
**Status:** NOT_IMPLEMENTED
**Evidence:** The `WorkOrder` model has no `notes` field. The `UnitOperationExecution` and `DowntimeInterval` models have `notes` fields, but `WorkOrder` does not.
**Gap:** Need to add optional `notes` field to `WorkOrder` schema and the creation form.

### REQ-7.1.9: Auto-allocate/reserve inventory per BOM (FIFO) on creation
**Status:** NOT_IMPLEMENTED
**Evidence:** `createWorkOrder()` in `src/lib/actions/work-orders.ts` creates the work order and its operations but does not perform any inventory allocation or reservation. Kit creation (`createKitForWorkOrder()` in `src/lib/actions/kitting.ts`) generates kit lines with required quantities from the BOM but does not auto-allocate specific lots. Lot assignment only happens during the manual `pickKitLine()` step.
**Gap:** The spec requires automatic FIFO-based inventory reservation at work order creation time. Currently, material allocation is entirely deferred to the kitting pick process and is manual, not FIFO-automated.

### REQ-7.1.10: Check availability and alert shortages on creation
**Status:** NOT_IMPLEMENTED
**Evidence:** `createWorkOrder()` does not check material availability against current inventory. The `getKitShortages()` function in `src/lib/actions/kitting.ts` (line 265) can identify shortages on an existing kit, but this is a post-hoc check, not a proactive availability check at creation time.
**Gap:** Need a pre-creation availability check that compares BOM requirements against `MaterialLot.qtyRemaining` and surfaces shortage alerts before/during work order creation.

### REQ-7.1.11: Generate kitting instructions on creation
**Status:** PARTIAL
**Evidence:** Kit creation exists via `createKitForWorkOrder()` in `src/lib/actions/kitting.ts` (line 19), which auto-generates kit lines from BOM items. However, this is a separate manual step triggered from the Kitting page (`src/app/admin/kitting/page.tsx`), not auto-generated at work order creation time.
**Gap:** Spec says kitting instructions should be auto-generated on work order creation. Currently, an admin must navigate to the Kitting page and explicitly click "Create Kit" for each work order.

### REQ-7.1.12: Check latest production process (routing) on creation
**Status:** PARTIAL
**Evidence:** `createWorkOrder()` accepts a `routingId` and creates operations from it. The create form provides a routing selector dropdown populated from the database.
**Gap:** No validation that the routing is the "latest" or most current version. The `Routing` model has no versioning fields (no `version`, `revision`, or `effectiveDate`). If a routing is updated, there is no mechanism to ensure a new work order uses the latest revision.

### REQ-7.1.13: Create production traveler on creation
**Status:** NOT_IMPLEMENTED
**Evidence:** No traveler model, traveler generation logic, or traveler UI component exists anywhere in the codebase. Searched for "traveler" and "traveller" with zero results.
**Gap:** Need a production traveler feature — either a printable document or digital view showing WO number, motor model, qty, BOM revision, process steps in sequence, and spaces for operator sign-off.

---

## 7.2 Kitting Instructions

### REQ-7.2.1: Pick list with part number/description
**Status:** IMPLEMENTED
**Evidence:** The `KitBuilder` component (`src/components/admin/KitBuilder.tsx`) renders a table of kit lines showing Material Code and Description columns (lines 282-295). Kit lines are created with `materialCode` and `description` from BOM items.

### REQ-7.2.2: Required quantity per line
**Status:** IMPLEMENTED
**Evidence:** Kit lines display "Qty Required" column (line 284). `qtyRequired` is calculated as `bomItem.qtyPerUnit * workOrder.qtyOrdered` in `createKitForWorkOrder()` (line 63).

### REQ-7.2.3: Lot numbers (FIFO-selected) on pick list
**Status:** PARTIAL
**Evidence:** Lot numbers are displayed in the kit detail table after picking (line 302-303). The `pickKitLine()` function accepts a `materialLotId` and validates the lot is available.
**Gap:** Lot selection is manual — the operator/supervisor chooses which lot to pick. There is no FIFO suggestion or enforcement. The spec requires FIFO-selected lot numbers to appear on the pick list proactively.

### REQ-7.2.4: Storage location per line
**Status:** NOT_IMPLEMENTED
**Evidence:** Neither `MaterialLot` nor `KitLine` models have a `storageLocation` field. The pick list does not display where materials are physically stored. Searched for "storage_location" and "storageLocation" with zero results.
**Gap:** Need a `storageLocation` field on `MaterialLot` and display it on the kitting pick list to guide pickers.

### REQ-7.2.5: Destination workstation per line
**Status:** NOT_IMPLEMENTED
**Evidence:** Kit lines do not reference a target station. The `BillOfMaterial` model links materials to stations (`stationId`), but this station reference is not carried through to `KitLine` records or displayed on the pick list. Searched for "destination" with zero results.
**Gap:** Need to include the destination station (from BOM's `stationId`) on kit lines and display it in the pick list UI.

### REQ-7.2.6: Checkbox confirmation per line
**Status:** IMPLEMENTED
**Evidence:** The `KitBuilder` component provides a "Pick" button per line (line 309-316) that opens a `KitPickDialog`. Once picked, the line shows a "Done" badge (line 318-319). The `pickKitLine()` action records who picked it, when, and the lot used. This fulfills the confirmation-per-line requirement functionally, though it uses a dialog rather than a simple checkbox.

### REQ-7.2.7: Printed or on-screen pick list
**Status:** PARTIAL
**Evidence:** On-screen pick list is implemented in `KitBuilder.tsx`. A `PrintButton` component exists at `src/components/supervisor/PrintButton.tsx`.
**Gap:** The print button exists for shift reports but is not integrated into the kitting UI. No dedicated print-optimized layout for kit pick lists.

### REQ-7.2.8: Distinguish subassembly kits
**Status:** NOT_IMPLEMENTED
**Evidence:** All kit lines are treated uniformly. There is no concept of subassemblies in the `BillOfMaterial`, `KitLine`, or `Kit` models. Searched for "subassembly" with zero results.
**Gap:** Need a mechanism to tag BOM items as subassembly components and visually distinguish subassembly kits from main assembly kits in the UI.

### REQ-7.2.9: Confirm each line deducts from reserved and moves to WIP status
**Status:** PARTIAL
**Evidence:** `pickKitLine()` in `src/lib/actions/kitting.ts` (line 137-153) decrements `MaterialLot.qtyRemaining` when a line is picked and records the picked quantity. Kit status progresses from `pending` -> `in_progress` -> `complete` as lines are picked.
**Gap:** There is no formal "reserved" vs "WIP" inventory status transition. The `MaterialLot` model has statuses `available | quarantine | expired | depleted` but no `reserved` or `wip` status. When material is picked for a kit, `qtyRemaining` is reduced but the lot status stays `available`. The spec implies a two-phase process: reservation (at WO creation) then WIP transition (at pick confirmation).

---

## 7.3 Production Traveler

### REQ-7.3.1: Printable/digital document with WO number, motor model, qty
**Status:** NOT_IMPLEMENTED
**Evidence:** No traveler document, page, or component exists in the codebase. Searched for "traveler" and "traveller" with zero results.
**Gap:** Need a traveler view/page that displays work order header information in a printable format.

### REQ-7.3.2: BOM revision on traveler
**Status:** NOT_IMPLEMENTED
**Evidence:** No BOM revision tracking exists. The `BillOfMaterial` model has no `revision` or `version` field. The `Routing` model also lacks versioning.
**Gap:** Need revision/version tracking on BOM and Routing models, and display it on the traveler document.

### REQ-7.3.3: All process steps in sequence on traveler
**Status:** NOT_IMPLEMENTED
**Evidence:** `WorkOrderOperation` records with sequence and station assignments exist and could serve as process steps, but no traveler document renders them.
**Gap:** The data exists (operations with sequence order) but no traveler UI/document presents them.

### REQ-7.3.4: Space for operator sign-off per step
**Status:** NOT_IMPLEMENTED
**Evidence:** `UnitOperationExecution` records the operator who performed each operation and timestamps, which could serve as a digital sign-off record. However, there is no explicit sign-off mechanism or traveler document with sign-off fields. Searched for "sign-off" and "signoff" with zero results.
**Gap:** Need either a physical sign-off field on the traveler or a digital sign-off confirmation step per operation.

### REQ-7.3.5: Data entry fields per step on traveler
**Status:** NOT_IMPLEMENTED
**Evidence:** `UnitOperationExecution` has a `notes` field and `result` field, and quality checks can capture measurements. However, no traveler document consolidates these fields.
**Gap:** Need a traveler document that presents data entry fields aligned with each process step.

### REQ-7.3.6: Physical audit trail retained
**Status:** PARTIAL
**Evidence:** The event log (`Event` model) provides a digital audit trail for all critical operations. `UnitOperationExecution` records provide operation-level audit data. `AuditLog` captures configuration changes.
**Gap:** No physical (printed/PDF) audit trail mechanism. The spec implies the ability to retain a physical traveler document as a compliance record.

---

## 7.4 Work Order Status Model

### REQ-7.4.1: Draft status
**Status:** NOT_IMPLEMENTED
**Evidence:** The `WorkOrder.status` field supports: `pending | released | in_progress | completed | cancelled`. There is no `draft` status. The initial status is `pending` (line 209 of schema, line 329 of work-orders.ts).
**Gap:** `pending` may serve as a functional equivalent of `draft`, but the spec distinguishes them. A `draft` status would imply an incomplete/unsaved WO that cannot be released yet, whereas `pending` implies ready-to-release.

### REQ-7.4.2: Released status
**Status:** IMPLEMENTED
**Evidence:** `released` status exists. `releaseWorkOrder()` in `src/lib/actions/work-orders.ts` (line 79) transitions from `pending` to `released`, sets `releasedAt` timestamp, and emits a `work_order_released` event with operator attribution.

### REQ-7.4.3: Kitting status
**Status:** NOT_IMPLEMENTED
**Evidence:** No `kitting` status exists on the `WorkOrder` model. Kit status is tracked on the separate `Kit` model (`pending | in_progress | complete | issued`), not on the work order itself.
**Gap:** Need a `kitting` status on WorkOrder that is set when kitting begins and cleared when kitting completes/kit is issued. Currently, work order and kit statuses are tracked independently.

### REQ-7.4.4: In Production status
**Status:** IMPLEMENTED
**Evidence:** `in_progress` status exists on WorkOrder. While not named "In Production" exactly, it serves the same purpose. The transition occurs during production execution.

### REQ-7.4.5: In Testing status
**Status:** NOT_IMPLEMENTED
**Evidence:** No `in_testing` or equivalent status exists on the WorkOrder model. Quality checks are recorded per-unit but do not drive a WO-level status transition.
**Gap:** Need an `in_testing` status to distinguish units/WOs in the testing phase from general production.

### REQ-7.4.6: Rework status
**Status:** PARTIAL
**Evidence:** `rework` is a valid status on the `Unit` model but NOT on the `WorkOrder` model. NCR disposition can set a unit to rework status, but the work order status does not reflect this.
**Gap:** Need a `rework` WO-level status or at minimum a way to flag a work order as having units in rework.

### REQ-7.4.7: Complete status
**Status:** IMPLEMENTED
**Evidence:** `completed` status exists. `completeWorkOrder()` in `src/lib/actions/work-orders.ts` (line 138) transitions to `completed`, sets `completedAt` timestamp, counts completed units, and emits a `work_order_completed` event.

### REQ-7.4.8: Shipped status
**Status:** NOT_IMPLEMENTED
**Evidence:** No `shipped` status exists on the WorkOrder model. No shipping module exists in the codebase.
**Gap:** Requires shipping module implementation and a `shipped` WO status.

### REQ-7.4.9: Cancelled status
**Status:** IMPLEMENTED
**Evidence:** `cancelled` status exists. `cancelWorkOrder()` in `src/lib/actions/work-orders.ts` (line 237) transitions to `cancelled` with reason tracking, audit logging, and event emission. Only `pending` and `released` orders can be cancelled.

### REQ-7.4.10: Each status transition timestamped and user-attributed
**Status:** PARTIAL
**Evidence:** `releasedAt` and `completedAt` timestamps exist on the WorkOrder model. Events capture the operator who triggered each transition. The `cancelWorkOrder()` function logs to audit trail with before/after state.
**Gap:** Not all transitions have dedicated timestamp fields. There is no `cancelledAt`, `kittingStartedAt`, `shippedAt`, etc. The event log captures all transitions but the WorkOrder model itself only has `releasedAt` and `completedAt`. For the missing statuses (draft, kitting, in_testing, rework, shipped), no transition tracking exists at all.

---

## 7.5 Work Order Dashboard

### REQ-7.5.1: View all active WOs with status
**Status:** IMPLEMENTED
**Evidence:** The admin Work Orders page (`src/app/admin/work-orders/page.tsx`) displays all work orders with status badges. The dashboard (`src/app/dashboard/page.tsx`) counts active work orders. The production page (`src/app/dashboard/production/page.tsx`) lists active work orders.

### REQ-7.5.2: Motor model displayed per WO
**Status:** IMPLEMENTED
**Evidence:** Work order list shows `productCode` and `productName` in the table (lines 397-405 of work-orders page).

### REQ-7.5.3: Quantity — planned vs built vs passed QC
**Status:** PARTIAL
**Evidence:** The work orders table shows `qtyCompleted / qtyOrdered` with a progress bar (lines 408-416). `qtyScrap` is tracked in the schema.
**Gap:** "Passed QC" quantity is not separately tracked or displayed. The system tracks `qtyCompleted` and `qtyScrap` but does not distinguish units that passed QC from those that completed operations. Quality check results exist per-unit but are not aggregated into a WO-level "passed QC" count on the dashboard.

### REQ-7.5.4: Current stage per WO
**Status:** PARTIAL
**Evidence:** Work order `status` is displayed as a badge. The WIP page (`src/app/dashboard/wip/page.tsx`) shows units grouped by station, indicating where work is happening.
**Gap:** "Current stage" should indicate which process step (station) the WO is currently at, not just the overall status. For a multi-unit WO, this would mean showing which stations have active units.

### REQ-7.5.5: Aging per WO
**Status:** NOT_IMPLEMENTED
**Evidence:** No aging calculation or display exists. Work orders have `createdAt` and `dueDate` fields that could support aging calculations, but no aging column or metric is computed or displayed.
**Gap:** Need to calculate and display WO age (time since creation or release) and/or days until due date, with visual indicators for overdue orders.

### REQ-7.5.6: Shortage alerts on dashboard
**Status:** NOT_IMPLEMENTED
**Evidence:** `getKitShortages()` exists in `src/lib/actions/kitting.ts` but is not surfaced on the work order dashboard. The main dashboard shows AI insights and active downtime but no material shortage alerts.
**Gap:** Need to surface material shortage information on the work order dashboard, either by checking kit line shortages or comparing BOM requirements against available inventory.

### REQ-7.5.7: Quality failure alerts on dashboard
**Status:** PARTIAL
**Evidence:** The main dashboard (`src/app/dashboard/page.tsx`) shows open NCR count. AI insights can flag quality anomalies. The NCR dashboard at `src/app/dashboard/ncr/page.tsx` provides detailed NCR tracking.
**Gap:** Quality failure alerts are not shown inline on the work order dashboard per WO. A supervisor must navigate to the separate NCR page to see failures.

### REQ-7.5.8: Overdue alerts on dashboard
**Status:** NOT_IMPLEMENTED
**Evidence:** No overdue calculation or alert exists. The `dueDate` field exists but is only displayed as a static date in the work order table. No comparison to current date, no visual warning for overdue orders.
**Gap:** Need overdue detection logic comparing `dueDate` to current date, with visual alerts/badges for work orders past their due date.

---

## File Reference

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` (lines 199-265) | WorkOrder, WorkOrderOperation, Unit models |
| `prisma/schema.prisma` (lines 410-448) | Kit, KitLine models |
| `src/lib/actions/work-orders.ts` | WO CRUD, release, complete, cancel actions |
| `src/lib/actions/kitting.ts` | Kit creation, picking, issuance, shortage check |
| `src/app/admin/work-orders/page.tsx` | Admin WO management UI |
| `src/app/admin/kitting/page.tsx` | Kitting page (server component wrapper) |
| `src/components/admin/KitBuilder.tsx` | Kit management UI with pick list |
| `src/app/api/admin/work-orders/route.ts` | WO API endpoint |
| `src/app/dashboard/page.tsx` | Main supervisor dashboard |
| `src/app/dashboard/production/page.tsx` | Production tracking dashboard |
| `src/app/dashboard/wip/page.tsx` | WIP tracking by station |
