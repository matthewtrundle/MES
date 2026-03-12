# Section 2: Procurement and Purchase Order Management

## Overview
The spec defines a full procurement module with structured PO lifecycle management, supplier master data, automatic data ingestion, and lead-time tracking. The current codebase has **no procurement module**. The only related implementation is a simple `purchaseOrderNumber` string field and a `supplier` string field on the `MaterialLot` model, used during material receiving. There is no PO entity, no supplier entity, no PO creation workflow, and no ingestion pipeline.

## Requirement Matrix

### 2.2 Purchase Order Data Model

| ID | Requirement | Status | Evidence | Gap Size |
|----|-------------|--------|----------|----------|
| 2.2.1 | PO number (system-generated or manual, unique) | NOT_IMPLEMENTED | `MaterialLot.purchaseOrderNumber` is a free-text string field, not a first-class entity. No uniqueness constraint, no PO model. | L |
| 2.2.2 | Order date field on PO | NOT_IMPLEMENTED | No PO model exists. | L |
| 2.2.3 | Buyer / requester name on PO | NOT_IMPLEMENTED | No PO model exists. | L |
| 2.2.4 | Supplier name and supplier ID linked to supplier master | NOT_IMPLEMENTED | `MaterialLot.supplier` is a plain string, not a FK to any supplier entity. No supplier master table. | L |
| 2.2.5 | PO line items with internal part number and revision (linked to part master) | NOT_IMPLEMENTED | No PO line item model. No part master relation. | L |
| 2.2.6 | Supplier part number on line item | NOT_IMPLEMENTED | No PO line item model. | L |
| 2.2.7 | Ordered quantity and unit of measure on line item | NOT_IMPLEMENTED | No PO line item model. `MaterialLot` has qty/UoM but for receiving, not ordering. | L |
| 2.2.8 | Unit cost and total line cost on line item | NOT_IMPLEMENTED | No cost fields anywhere in schema. | M |
| 2.2.9 | Country of origin on line item | NOT_IMPLEMENTED | No country of origin field in codebase. | S |
| 2.2.10 | Expected lead time (days) and calculated ETA date | NOT_IMPLEMENTED | No lead time fields. | M |
| 2.2.11 | Lot / batch number assigned at order or receiving | PARTIAL | `MaterialLot.lotNumber` exists and is assigned at receiving time via `MaterialReceivingForm`. Not assignable at PO creation since no PO creation exists. | M |
| 2.2.12 | Link to revision-controlled drawing (PDF upload) per line item | NOT_IMPLEMENTED | No file upload or document storage functionality. | L |
| 2.2.13 | CTQ inspection dimensions per line item (see Section 4) | NOT_IMPLEMENTED | No CTQ dimension model or linkage. | L |
| 2.2.14 | Notes / special handling instructions on line item | NOT_IMPLEMENTED | No notes field on any PO-related structure. | XS |
| 2.2.15 | PO-level fields: currency, payment terms, shipping method, total PO value | NOT_IMPLEMENTED | No PO model, no financial fields. | M |
| 2.2.16 | PO status lifecycle: Draft, Submitted, Partially Received, Fully Received, Closed, Cancelled | NOT_IMPLEMENTED | No PO status tracking. `MaterialLot.status` tracks lot status (available/quarantine/expired/depleted), not PO status. | L |

### 2.3 PO Creation

| ID | Requirement | Status | Evidence | Gap Size |
|----|-------------|--------|----------|----------|
| 2.3.1 | Web form to create a new PO | NOT_IMPLEMENTED | No procurement pages at `src/app/**/procurement/` or `src/app/**/purchase*/`. | XL |
| 2.3.2 | Search part master to select parts for PO | NOT_IMPLEMENTED | No part master search for PO context. | M |
| 2.3.3 | Auto-populate supplier info from supplier master | NOT_IMPLEMENTED | No supplier master exists. | M |
| 2.3.4 | Add multiple line items in a single PO | NOT_IMPLEMENTED | No PO form or line item UI. | L |
| 2.3.5 | Upload PDF drawing per line item | NOT_IMPLEMENTED | No file upload infrastructure. | L |
| 2.3.6 | Define or select CTQ inspection dimensions per line item | NOT_IMPLEMENTED | No CTQ dimension system. | L |
| 2.3.7 | Specify lot number manually or defer to auto-generation | PARTIAL | `MaterialReceivingForm` accepts manual lot number input (`src/components/admin/MaterialReceivingForm.tsx`). Auto-generation not implemented. Not in PO context. | M |

### 2.4 Automatic Data Ingestion

| ID | Requirement | Status | Evidence | Gap Size |
|----|-------------|--------|----------|----------|
| 2.4.1 | CSV or Excel file upload with configurable field mapping | NOT_IMPLEMENTED | No file import functionality in codebase. | XL |
| 2.4.2 | Email parsing: designated inbox for structured PO data extraction | NOT_IMPLEMENTED | No email integration. | XL |
| 2.4.3 | REST API endpoint for JSON format PO data | NOT_IMPLEMENTED | No PO API endpoint. Existing API routes are for auth, simulation, stations, NCR, and work orders only. | L |
| 2.4.4 | Ingested POs reviewed and confirmed by buyer before activation | NOT_IMPLEMENTED | No PO review/confirmation workflow. | M |

### 2.5 Supplier Master

| ID | Requirement | Status | Evidence | Gap Size |
|----|-------------|--------|----------|----------|
| 2.5.1 | Supplier master record: name, ID, contact info | NOT_IMPLEMENTED | Supplier is a free-text string on `MaterialLot`. No `Supplier` model in Prisma schema. | L |
| 2.5.2 | Country of origin on supplier | NOT_IMPLEMENTED | No supplier entity. | S |
| 2.5.3 | Historical on-time delivery rate | NOT_IMPLEMENTED | No delivery tracking. | L |
| 2.5.4 | Historical quality acceptance rate | NOT_IMPLEMENTED | No quality metrics tied to suppliers. | L |
| 2.5.5 | Preferred parts list per supplier | NOT_IMPLEMENTED | No supplier-part relationship. | M |
| 2.5.6 | Notes and qualification status on supplier | NOT_IMPLEMENTED | No supplier entity. | S |

### 2.6 Lead Time Tracking

| ID | Requirement | Status | Evidence | Gap Size |
|----|-------------|--------|----------|----------|
| 2.6.1 | Calculate and maintain actual lead time data per supplier-part combination | NOT_IMPLEMENTED | No lead time tracking, no supplier-part entity, no delivery date tracking. | L |

## Summary Statistics

| Status | Count | Percentage |
|--------|-------|------------|
| IMPLEMENTED | 0 | 0% |
| PARTIAL | 2 | 7% |
| NOT_IMPLEMENTED | 27 | 93% |
| DEFERRED | 0 | 0% |
| **Total** | **29** | |

## Gap Size Distribution

| Size | Count | Description |
|------|-------|-------------|
| XS | 1 | Notes field |
| S | 3 | Single field additions |
| M | 8 | Moderate features requiring new logic |
| L | 13 | Significant features requiring new models/pages |
| XL | 3 | Major subsystems (PO creation form, CSV import, email parsing) |
| XXL | 0 | |

## Implementation Notes

### What Exists (Minimal)
- `MaterialLot` model (`prisma/schema.prisma:295-319`) has `supplier` (string) and `purchaseOrderNumber` (string) as optional free-text fields
- `MaterialReceivingForm` (`src/components/admin/MaterialReceivingForm.tsx`) allows manual entry of supplier name and PO number during lot receiving
- `receiveMaterialLot` server action (`src/lib/actions/material-receiving.ts`) persists these fields
- Seed data (`prisma/seed.ts:380-433`) includes sample PO numbers (PO-2024-001 through PO-2024-003) and supplier names

### Critical Gaps
1. **No PO entity**: The entire PO data model (2.2) requires a `PurchaseOrder` model with `PurchaseOrderLineItem` child model, both with full field sets
2. **No Supplier entity**: The supplier master (2.5) requires a `Supplier` model with relations to parts and quality metrics
3. **No procurement UI**: An entire procurement section of the app needs to be built (pages, forms, tables, status management)
4. **No ingestion pipeline**: CSV/Excel import, email parsing, and REST API ingestion are all absent
5. **No financial fields**: Cost, currency, payment terms are completely absent from the schema
6. **No document management**: PDF upload for drawings is not supported anywhere

### Recommended Implementation Order
1. Create `Supplier` and `PurchaseOrder`/`PurchaseOrderLineItem` Prisma models (L)
2. Build supplier master CRUD pages (L)
3. Build PO creation form with line items (XL)
4. Build PO status lifecycle management (L)
5. Add REST API endpoint for PO ingestion (L)
6. Add CSV/Excel import (XL)
7. Add lead-time tracking (L)
8. Add email parsing (XL) - consider deferring to Phase 2

### Estimated Total Effort: XXL
This section represents a greenfield module with no meaningful existing implementation. The two PARTIAL items (lot number at receiving and manual supplier entry) provide negligible foundation for the full procurement system described in the spec.
