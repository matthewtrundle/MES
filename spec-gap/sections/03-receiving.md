# Section 3: Receiving - Gap Analysis

## Section Overview
The receiving module allows the receiving manager to match incoming physical shipments to open purchase orders and record receipt details. Receiving transitions parts from "on order" to "pending inspection" status.

## Requirements Extraction & Classification

### 3.1 Overview

| ID | Requirement | Status | Gap Size | Evidence / Notes |
|----|-------------|--------|----------|------------------|
| 3.1.1 | Receiving module allows receiving manager to match incoming shipments to open POs | NOT_IMPLEMENTED | L | No PurchaseOrder model exists in the DB. The `MaterialReceivingForm` accepts a free-text PO number field but has no PO lookup/matching capability. Receiving is decoupled from any procurement workflow. |
| 3.1.2 | Receiving transitions part status from "on order" to "pending incoming inspection" | NOT_IMPLEMENTED | M | MaterialLot status values are `available`, `quarantine`, `expired`, `depleted`. There is no "on order" or "pending inspection" status. Parts go directly to "available" or "quarantine" on receipt. |

### 3.2 Receiving Workflow

| ID | Requirement | Status | Gap Size | Evidence / Notes |
|----|-------------|--------|----------|------------------|
| 3.2.1 | Receiving manager opens Receiving interface on web or mobile device | PARTIAL | S | Web interface exists at `/admin/materials` with `MaterialReceivingForm.tsx` and `MaterialLotTable.tsx`. No mobile-optimized or responsive receiving view. No dedicated receiving manager role. |
| 3.2.2 | Search for PO using: PO number, supplier name, part number, expected delivery date, or tracking number | NOT_IMPLEMENTED | L | No PO search functionality. The form has a simple free-text PO number input field; no search/lookup against existing POs. No tracking number or expected delivery date fields exist on any model. |
| 3.2.3 | Select matching PO, confirm/adjust received quantity per line item | NOT_IMPLEMENTED | L | No PO line-item concept exists. User manually enters lot number, material code, and quantity from scratch rather than selecting from a PO. |
| 3.2.4 | Record actual delivery date, carrier, tracking number, condition notes | PARTIAL | M | `receivedAt` is auto-set to `now()` on the MaterialLot model. No fields exist for carrier, tracking number, or condition notes in the schema or form. |
| 3.2.5 | Confirm receipt -- system transitions part status to Pending Incoming Inspection and notifies quality inspector | NOT_IMPLEMENTED | L | No "pending incoming inspection" status transition. No notification system exists. Parts go straight to "available" or "quarantine". No quality inspector notification mechanism. |
| 3.2.6 | Support splitting and partial receiving for multi-PO shipments | NOT_IMPLEMENTED | L | No concept of partial receiving, split shipments, or multi-PO shipment handling. Each lot is received independently as a standalone record. |

### 3.3 Receiving Record

| ID | Requirement | Status | Gap Size | Evidence / Notes |
|----|-------------|--------|----------|------------------|
| 3.3.1 | Each receiving event produces an immutable record | PARTIAL | S | A `material_lot_received` event is emitted to the events table via `emitEvent()` in `material-receiving.ts`. The event payload includes lotNumber, materialCode, qtyReceived, unitOfMeasure, supplier, purchaseOrderNumber, and status. |
| 3.3.2 | Record includes: PO number | IMPLEMENTED | - | `purchaseOrderNumber` field exists on MaterialLot model and is captured in the event payload. |
| 3.3.3 | Record includes: line items | NOT_IMPLEMENTED | M | No line-item concept. Each MaterialLot is a single entry; there is no link to PO line items or multi-line receiving. |
| 3.3.4 | Record includes: received quantity | IMPLEMENTED | - | `qtyReceived` field on MaterialLot, included in event payload. |
| 3.3.5 | Record includes: receiving date | IMPLEMENTED | - | `receivedAt` auto-set on MaterialLot creation. Shown in `MaterialLotTable.tsx`. |
| 3.3.6 | Record includes: carrier | NOT_IMPLEMENTED | S | No carrier field on MaterialLot model or receiving form. |
| 3.3.7 | Record includes: tracking number | NOT_IMPLEMENTED | S | No tracking number field on MaterialLot model or receiving form. |
| 3.3.8 | Record includes: receiver name | IMPLEMENTED | - | `receivedById` links to User model. `receivedBy.name` displayed in MaterialLotTable. |
| 3.3.9 | Record includes: condition notes | NOT_IMPLEMENTED | S | No condition notes field on MaterialLot model or receiving form. |

### 3.4 Part Marking and Labeling

| ID | Requirement | Status | Gap Size | Evidence / Notes |
|----|-------------|--------|----------|------------------|
| 3.4.1 | Auto-generate labels upon receipt confirmation | NOT_IMPLEMENTED | L | No label generation logic anywhere in the codebase. |
| 3.4.2 | Configurable label content (part number, revision, supplier, lot number, serial within lot, received date, country of origin, PO number, QR/barcode) | NOT_IMPLEMENTED | XL | No label template system. No country of origin or revision fields on MaterialLot. No serial-within-lot concept. No barcode/QR generation. |
| 3.4.3 | Configurable label format per part category | NOT_IMPLEMENTED | L | No part category concept tied to label formatting. No label configuration system. |
| 3.4.4 | Support printing to standard label printers | NOT_IMPLEMENTED | L | No print integration. A `PrintButton.tsx` exists in supervisor components but it is for browser print of traceability reports, not label printing. |

### 3.5 Discrepancy Handling

| ID | Requirement | Status | Gap Size | Evidence / Notes |
|----|-------------|--------|----------|------------------|
| 3.5.1 | Flag quantity discrepancies (received vs. ordered) | NOT_IMPLEMENTED | M | No PO expected quantity to compare against. No discrepancy detection logic. |
| 3.5.2 | Short shipments left open for subsequent delivery | NOT_IMPLEMENTED | M | No concept of open/partial shipments. No PO line-item tracking for remaining expected quantities. |
| 3.5.3 | Over-shipments reviewed before admitting to inventory | NOT_IMPLEMENTED | M | No over-shipment detection or review workflow. All received quantities are accepted directly. |

## Summary Statistics

| Status | Count |
|--------|-------|
| IMPLEMENTED | 4 |
| PARTIAL | 3 |
| NOT_IMPLEMENTED | 15 |
| DEFERRED | 0 |
| **Total** | **22** |

## Key Gaps

### Critical Gaps (L/XL/XXL)
1. **No PO Integration (L)** -- The entire receiving workflow is decoupled from purchase orders. There is no PO model, no PO search, no PO line-item matching. The spec envisions receiving as a PO-driven process; the implementation is a standalone lot-entry form.
2. **No "Pending Inspection" Status Transition (L)** -- The spec requires receiving to transition parts to "pending incoming inspection" and notify a quality inspector. The implementation skips this entirely, going straight to "available" or "quarantine".
3. **No Label Generation System (XL)** -- The entire labeling subsystem (auto-generation, configurable content, configurable format, printer integration) is absent. This is a large feature area.
4. **No Partial/Split Receiving (L)** -- No support for partial receipts, split shipments, or tracking remaining expected quantities against POs.
5. **No Discrepancy Handling (M each, M aggregate)** -- No comparison of received vs. ordered quantities, no short/over-shipment workflows.

### What Works Well
- Basic material lot receiving with event emission is solid
- MaterialLot model captures core fields (lot number, material code, qty, supplier, PO number, receiver, date)
- Immutable event record is emitted on receipt with idempotency key
- RBAC enforcement on receiving actions (admin/supervisor required)
- Clean UI form and table for lot management

### Recommended Priority
1. **PO model + PO-driven receiving workflow** -- prerequisite for discrepancy handling and partial receiving
2. **Add missing record fields** (carrier, tracking number, condition notes) -- schema migration + form update
3. **"Pending inspection" status + IQC notification** -- ties into Section 4 (IQC)
4. **Discrepancy handling** -- depends on PO integration
5. **Label generation system** -- can be deferred if physical labels are not needed for MVP demo

## Implementation Effort Estimate
- **Schema changes**: S (add carrier, trackingNumber, conditionNotes to MaterialLot; add PurchaseOrder + PurchaseOrderLine models)
- **PO-driven receiving workflow**: L (new search UI, PO matching, line-item confirmation, partial receiving)
- **Status transition + notifications**: M (new status enum values, notification system)
- **Label system**: XL (template engine, QR/barcode generation, printer integration)
- **Discrepancy handling**: M (comparison logic, review workflow UI)
- **Overall section effort**: XL
