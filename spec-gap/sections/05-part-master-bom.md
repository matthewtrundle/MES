# Section 5: Part Master & Bill of Materials — Gap Analysis

## Overview

Section 5 defines a comprehensive Part Master catalog, revision-controlled multi-level BOMs, and a formal BOM change management process. The current codebase has a basic `BillOfMaterial` model tied to routings/stations with CRUD operations, but lacks a standalone Part Master entity entirely and has no revision control, multi-level structure, or change management workflow.

---

## 5.1 Part Master — Central Catalog

### REQ-5.1.1: Part Master Entity
- **Spec**: Dedicated Part Master entity serving as the central catalog for every part
- **Status**: NOT IMPLEMENTED
- **Gap**: No `PartMaster` (or equivalent) model exists in `prisma/schema.prisma`. Materials are referenced only by `materialCode` strings scattered across `BillOfMaterial`, `MaterialLot`, and `KitLine` tables with no single authoritative catalog. Material metadata (description, UoM) is duplicated across tables rather than normalized.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.1.2: Internal Part Number Format (510-XXXXX)
- **Spec**: Standardized internal part number format `510-XXXXX`
- **Status**: NOT IMPLEMENTED
- **Gap**: Material codes use ad-hoc strings (e.g., `WIRE-CU-18AWG`, `MAG-NEOD-10MM`). No format validation or enforcement exists.
- **Priority**: MEDIUM
- **Effort**: MEDIUM

### REQ-5.1.3: Part Name and Description
- **Spec**: Each part has a name and description
- **Status**: PARTIAL
- **Gap**: `BillOfMaterial.description` and `MaterialLot.description` store descriptions per-record, but there is no canonical name/description in a Part Master. Descriptions can diverge across lots and BOM entries for the same material code.
- **Priority**: MEDIUM
- **Effort**: SMALL (normalized once Part Master exists)

### REQ-5.1.4: Revision (Letter-Based A, B, C)
- **Spec**: Letter-based revision tracking on parts (A, B, C...)
- **Status**: NOT IMPLEMENTED
- **Gap**: No `revision` field exists on any part-related model. `BillOfMaterial`, `Routing`, and `MaterialLot` have no revision concept.
- **Priority**: HIGH
- **Effort**: MEDIUM

### REQ-5.1.5: Part Category
- **Spec**: Enumerated categories: Magnetic, Electrical, Electronics, Mechanical, Hardware, Process Materials, Tooling, Packaging, Other
- **Status**: NOT IMPLEMENTED
- **Gap**: No category field exists anywhere. Parts are not classified.
- **Priority**: MEDIUM
- **Effort**: SMALL

### REQ-5.1.6: Unit of Measure (UoM)
- **Spec**: UoM defined per part in the master catalog
- **Status**: PARTIAL
- **Gap**: `BillOfMaterial.unitOfMeasure` and `MaterialLot.unitOfMeasure` both carry UoM, but it is not centralized. The same material could have inconsistent UoMs across records.
- **Priority**: MEDIUM
- **Effort**: SMALL (normalized once Part Master exists)

### REQ-5.1.7: Preferred Suppliers and Supplier Part Numbers
- **Spec**: Multiple preferred suppliers with supplier-specific part numbers per part
- **Status**: NOT IMPLEMENTED
- **Gap**: `MaterialLot.supplier` captures the supplier per received lot, but there is no `PreferredSupplier` entity or supplier part number mapping on the Part Master. No way to define approved supplier lists.
- **Priority**: MEDIUM
- **Effort**: MEDIUM

### REQ-5.1.8: Country of Origin
- **Spec**: Country of origin tracked per part
- **Status**: NOT IMPLEMENTED
- **Gap**: No country-of-origin field on any model.
- **Priority**: LOW
- **Effort**: SMALL

### REQ-5.1.9: Country of Origin of Subcomponents (Magnets)
- **Spec**: For magnets specifically, country of origin of subcomponents must be tracked
- **Status**: NOT IMPLEMENTED
- **Gap**: No subcomponent origin tracking. No special handling for magnet parts.
- **Priority**: LOW
- **Effort**: SMALL

### REQ-5.1.10: Current Inventory Qty and Location
- **Spec**: Part Master shows current inventory quantity and storage location
- **Status**: PARTIAL
- **Gap**: `getInventorySummary()` in `src/lib/actions/inventory.ts` aggregates `qtyRemaining` across `MaterialLot` records per material code, giving on-hand totals. However, there is no storage location field on `MaterialLot` or anywhere else. Inventory data is not surfaced on a Part Master view (no Part Master exists).
- **Priority**: MEDIUM
- **Effort**: SMALL (location field) / MEDIUM (Part Master integration)

### REQ-5.1.11: Min Stock Level (Reorder Point)
- **Spec**: Configurable minimum stock / reorder point per part
- **Status**: NOT IMPLEMENTED
- **Gap**: `getLowStockMaterials()` uses a consumption-rate-based heuristic (days remaining) rather than a configured reorder point. No `minStockLevel` field exists.
- **Priority**: MEDIUM
- **Effort**: SMALL

### REQ-5.1.12: Target Stock Level
- **Spec**: Configurable target stock level per part
- **Status**: NOT IMPLEMENTED
- **Gap**: No target stock level field anywhere.
- **Priority**: LOW
- **Effort**: SMALL

### REQ-5.1.13: Standard Cost
- **Spec**: Standard cost per part for costing/valuation
- **Status**: NOT IMPLEMENTED
- **Gap**: No cost data on any model.
- **Priority**: LOW
- **Effort**: SMALL

### REQ-5.1.14: Drawing PDF (Current Revision)
- **Spec**: Ability to attach and view the current drawing PDF per part
- **Status**: NOT IMPLEMENTED
- **Gap**: No file attachment or document management capability. No drawing references.
- **Priority**: LOW
- **Effort**: LARGE (requires file storage infrastructure)

### REQ-5.1.15: CTQ Inspection Dimensions Linked
- **Spec**: Link critical-to-quality inspection dimensions to the part
- **Status**: NOT IMPLEMENTED
- **Gap**: `QualityCheckDefinition` exists with measurement parameters but is linked to stations, not to parts. No explicit CTQ dimension linkage to the Part Master.
- **Priority**: MEDIUM
- **Effort**: MEDIUM

### REQ-5.1.16: Serialization Requirement (None / Lot-level / Unit-level)
- **Spec**: Configurable serialization requirement per part
- **Status**: NOT IMPLEMENTED
- **Gap**: `MaterialLot` implicitly supports lot-level tracking. `Unit` supports unit-level serial numbers. But there is no Part Master field to define which serialization level applies to which part. The system assumes lot-level for materials and unit-level for finished goods with no configuration.
- **Priority**: MEDIUM
- **Effort**: SMALL

### REQ-5.1.17: Hazardous Material Flag and Handling Notes
- **Spec**: Boolean hazmat flag plus handling notes per part
- **Status**: NOT IMPLEMENTED
- **Gap**: No hazardous material fields on any model.
- **Priority**: LOW
- **Effort**: SMALL

### REQ-5.1.18: Active/Obsolete Status
- **Spec**: Parts can be marked active or obsolete
- **Status**: PARTIAL
- **Gap**: `BillOfMaterial.active` exists as a boolean. `MaterialLot.status` includes `available`, `quarantine`, `expired`, `depleted`. But there is no Part Master-level active/obsolete status that would prevent a part from being used across the system.
- **Priority**: MEDIUM
- **Effort**: SMALL

---

## 5.2 Bill of Materials

### REQ-5.2.1: BOM Linked to Routing/Product
- **Spec**: BOM defined per motor model / routing
- **Status**: IMPLEMENTED
- **Gap**: `BillOfMaterial` links to `Routing` via `routingId`. `Routing` has a `productCode`. BOM items are fetched per routing in `getBomForRouting()`. The admin UI at `/admin/bom` allows viewing/editing BOM per routing.
- **Priority**: N/A
- **Effort**: N/A

### REQ-5.2.2: BOM Items with Material, Qty, UoM, Station
- **Spec**: Each BOM line specifies material, quantity per unit, unit of measure, and which station consumes it
- **Status**: IMPLEMENTED
- **Gap**: `BillOfMaterial` model has `materialCode`, `qtyPerUnit`, `unitOfMeasure`, and `stationId`. The `BomEditor` component and `createBomItem`/`updateBomItem` server actions support full CRUD.
- **Priority**: N/A
- **Effort**: N/A

### REQ-5.2.3: Revision Control (Historical Revisions Preserved)
- **Spec**: BOMs must be revision-controlled; previous revisions must remain accessible
- **Status**: NOT IMPLEMENTED
- **Gap**: The `BillOfMaterial` model has no revision field. Updates overwrite in place (via `updateBomItem`). Deletes hard-delete records (via `deleteBomItem`). No revision history is preserved. The `AuditLog` captures before/after JSON for updates, providing minimal traceability, but this is not a proper BOM revision system.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.2.4: Multi-Level BOM (Subassembly Structure)
- **Spec**: Multi-level BOM supporting subassembly hierarchy: Stator, Rotor, Wire Harness, Base, Final Assembly
- **Status**: NOT IMPLEMENTED
- **Gap**: `BillOfMaterial` is a flat, single-level structure. There is no `parentBomId` or `level` field. No subassembly concept. All materials are listed at the same level against a routing/station.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.2.5: Motor-Model Specific BOMs
- **Spec**: BOMs specific to each motor model
- **Status**: IMPLEMENTED
- **Gap**: `Routing.productCode` acts as the motor model identifier. Each routing has its own BOM items. Multiple routings can exist for different products.
- **Priority**: N/A
- **Effort**: N/A

### REQ-5.2.6: Variant-Aware (Optional/Variant Components)
- **Spec**: BOM supports optional or variant components that may differ by configuration
- **Status**: NOT IMPLEMENTED
- **Gap**: No variant or optionality concept on `BillOfMaterial`. Every BOM item is treated as required. No mechanism to define component alternatives or configuration-driven inclusion/exclusion.
- **Priority**: MEDIUM
- **Effort**: MEDIUM

### REQ-5.2.7: Engineering BOM to Manufacturing BOM Translation
- **Spec**: Support translation from eBOM (engineering) to mBOM (manufacturing)
- **Status**: NOT IMPLEMENTED
- **Gap**: Only one BOM type exists. No distinction between engineering and manufacturing BOMs. No translation workflow.
- **Priority**: LOW
- **Effort**: LARGE

### REQ-5.2.8: Subassembly Structure (Stator, Rotor, Wire Harness, Base, Final Assembly)
- **Spec**: Defined subassembly hierarchy per motor
- **Status**: NOT IMPLEMENTED
- **Gap**: No subassembly entities. The station-based BOM loosely maps consumption points but does not represent a subassembly build structure.
- **Priority**: HIGH
- **Effort**: LARGE

---

## 5.3 BOM Change Management

### REQ-5.3.1: Controlled Change Process (Propose/Review/Approve)
- **Spec**: Engineer proposes BOM change, approver reviews and approves/rejects
- **Status**: NOT IMPLEMENTED
- **Gap**: BOM changes via `createBomItem`/`updateBomItem`/`deleteBomItem` take effect immediately with admin RBAC only. No proposal, review, or approval workflow. No `BomChangeRequest` entity or approval state machine.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.3.2: New BOM Revision on Approval
- **Spec**: Approved changes create a new BOM revision; previous remains accessible
- **Status**: NOT IMPLEMENTED
- **Gap**: No revision system (see REQ-5.2.3). Changes are destructive in-place mutations. Audit log provides some forensic traceability but not structured revision access.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.3.3: Work Orders Auto-Use New Revision After Effective Date
- **Spec**: Work orders created after the BOM effective date automatically use the new revision
- **Status**: NOT IMPLEMENTED
- **Gap**: No effective date concept. No BOM revision linkage on `WorkOrder`. Work orders reference `Routing` but not a specific BOM revision. All work orders always see the current (only) BOM state.
- **Priority**: HIGH
- **Effort**: LARGE

### REQ-5.3.4: Active Work Order Flagging on BOM Change
- **Spec**: Active (in-progress) work orders are flagged if their BOM changes during execution
- **Status**: NOT IMPLEMENTED
- **Gap**: No mechanism to detect or flag BOM changes affecting in-flight work orders. No notifications or warnings.
- **Priority**: MEDIUM
- **Effort**: MEDIUM

---

## Summary

| Category | Total | Implemented | Partial | Not Implemented |
|----------|-------|-------------|---------|-----------------|
| 5.1 Part Master | 18 | 0 | 4 | 14 |
| 5.2 BOM | 8 | 3 | 0 | 5 |
| 5.3 BOM Change Mgmt | 4 | 0 | 0 | 4 |
| **Total** | **30** | **3** | **4** | **23** |

### Coverage: ~13% (3 fully implemented + 4 partial out of 30 requirements)

### Key Gaps (HIGH priority):
1. **No Part Master entity** — The entire 5.1 section depends on a `PartMaster` model that does not exist. Materials are identified by ad-hoc string codes with no central catalog.
2. **No BOM revision control** — Changes are destructive in-place edits with no revision history, effective dates, or ability to view historical BOMs.
3. **No multi-level/subassembly BOM** — The flat BOM structure cannot represent the specified Stator/Rotor/Wire Harness/Base/Final Assembly hierarchy.
4. **No BOM change management workflow** — No propose/review/approve process; changes are immediate.
5. **No work order BOM version binding** — Work orders cannot be pinned to a specific BOM revision.

### What Exists:
- Basic flat BOM tied to routing and station (`BillOfMaterial` model)
- CRUD server actions with RBAC (admin-only for writes) and audit logging
- Admin UI for viewing/editing BOM per routing (`/admin/bom`, `BomEditor.tsx`)
- Operator-facing BOM checklist at station (`StationBomChecklist.tsx`)
- Material lot tracking with supplier, qty, expiry, and status
- Inventory summary with on-hand/committed/available calculations
