# Section 1: System Overview — Gap Analysis

**Spec Reference:** SPEC.md lines 43-75
**Analysis Date:** 2026-03-12
**Analyst:** Claude Opus 4.6

---

## Summary

Section 1 defines the product vision, design philosophy, and key user roles. The codebase implements the core production execution loop well (work orders, units, stations, quality, downtime, traceability, kitting) but is missing several upstream and downstream modules (procurement, receiving/IQC, shipping). The role model is simplified from 8 spec roles to 3. Extensibility-by-configuration is partially present for quality checks but not generalized.

| Status | Count |
|--------|-------|
| IMPLEMENTED | 8 |
| PARTIAL | 7 |
| NOT_IMPLEMENTED | 6 |

---

## 1.1 Product Vision

### REQ-1.1.1: Single system of record connecting all production stages
**Status:** PARTIAL
**Evidence:** The system covers kitting, production, quality/inspection, and serialization through models in `prisma/schema.prisma` (WorkOrder, Unit, Station, Kit, QualityCheckResult, NonconformanceRecord, MaterialLot, UnitMaterialConsumption). An immutable event log (`Event` model) captures all critical operations.
**Gap:** Procurement/purchase orders, formal receiving with inspection (IQC), and shipping modules are absent. The `MaterialLot` model has a `purchaseOrderNumber` field but there is no PurchaseOrder entity or procurement workflow. No shipping/packing list models or pages exist.

### REQ-1.1.2: Every motor carries a traceable digital history from raw material to finished product
**Status:** PARTIAL
**Evidence:** Traceability is implemented via `src/app/dashboard/traceability/page.tsx`, `src/components/supervisor/TraceabilitySearch.tsx`, and `src/components/supervisor/TraceabilityGraph.tsx`. Serial numbers link to units, which link to material lot consumptions, quality results, NCRs, and operation executions.
**Gap:** Traceability chain breaks at both ends: no formal receiving record links material lots to purchase orders/supplier certificates, and no shipping record links finished units to outbound shipments. The "raw material to finished product" chain is therefore incomplete.

### REQ-1.1.3: System scales from low-volume hand-assembly to high-volume semi-automated production without re-architecture
**Status:** PARTIAL
**Evidence:** The event-driven architecture (`src/lib/db/events.ts`) with immutable events and idempotency keys provides a sound foundation for scaling. The `Routing` model supports configurable process flows.
**Gap:** No evidence of automated data capture integration (edge devices, PLC/SCADA connectors). The `EventSource` type includes `'edge'` as a value but no edge integration code exists. No load testing or performance benchmarks found.

### REQ-1.1.4: Accommodate at least 3 motor SKUs with a mix of custom and common subcomponents
**Status:** PARTIAL
**Evidence:** The `Routing` model supports multiple product codes and the `BillOfMaterial` model links materials to routings and stations. The `WorkOrder` model has `productCode` and `productName` fields.
**Gap:** Seed data only contains 1 SKU (`MOTOR-STD-001`). No evidence of multiple product variants being configured or tested. The BOM model exists but multi-SKU with shared/custom subcomponents is not demonstrated.

---

## 1.2 Design Philosophy

### REQ-1.2.1: Operator-first — every floor interface operable by non-technical user in under 30 seconds of training
**Status:** PARTIAL
**Evidence:** Operator UI exists at `src/app/station/page.tsx` and `src/app/station/[stationId]/page.tsx` with dedicated operator components in `src/components/operator/`. The `CLAUDE.md` project instructions specify "Large touch targets (min 44px), clear state indicators" for operator UI. The `MaterialConsumptionDialog` component references touch-friendly patterns.
**Gap:** No formal usability testing evidence. The 30-second training claim is a UX target that cannot be verified from code alone. Some operator dialogs (e.g., MaterialConsumptionDialog) have moderate complexity.

### REQ-1.2.2: Data integrity over speed — enforce completeness and correctness at point of entry; no record advances with missing required fields
**Status:** IMPLEMENTED
**Evidence:** Server actions in `src/lib/actions/` perform validation before database writes. Examples found in: `work-orders.ts`, `units.ts`, `kitting.ts`, `material-receiving.ts`, `quality.ts`, `downtime.ts`, `bom.ts`, `inventory-adjustment.ts`, `materials.ts`. RBAC checks via `requireRole()` are enforced in all server actions before any mutations.

### REQ-1.2.3: Extensibility by default — adding new data fields, inspection dimensions, process steps, or product variants achievable by admin without development
**Status:** PARTIAL
**Evidence:** Quality check definitions are admin-configurable via `src/app/admin/quality-checks/page.tsx` and `src/lib/actions/admin/quality-checks.ts`, supporting `pass_fail`, `measurement`, and `checklist` check types with JSON parameters. Stations, downtime reasons, and BOMs are also admin-configurable. The `Routing` model uses a JSON `operations` field for flexible process step definition.
**Gap:** No general-purpose "custom fields" system. Adding a new data field to a work order, unit, or material lot requires schema changes and code deployment. The extensibility is limited to pre-designed configuration surfaces (quality checks, stations, downtime reasons, BOMs, routings). No admin UI for creating new product variants/routings.

### REQ-1.2.4: Composability by default — loosely coupled, non-monolithic
**Status:** PARTIAL
**Evidence:** The codebase uses a modular structure with separated server actions (`src/lib/actions/`), dedicated component directories (`src/components/operator/`, `src/components/supervisor/`, `src/components/admin/`), and an event-driven architecture that decouples event emission from state derivation.
**Gap:** This is a Next.js monolith — all modules share a single database, single deployment, and single process. While the code is well-organized, there are no service boundaries, no API contracts between modules, and no ability to deploy or scale components independently. The spec's use of "non-monolithic" is in tension with the current architecture.

### REQ-1.2.5: Traceability as a first-class feature — every serialized component and production event is linked
**Status:** IMPLEMENTED
**Evidence:** The `Unit` model has a unique `serialNumber`. `UnitMaterialConsumption` links units to material lots. `UnitOperationExecution` records every operation on a unit. `QualityCheckResult` and `NonconformanceRecord` link to units. The `Event` model captures all production events with `unitId` linkage. Traceability search UI exists at `src/app/dashboard/traceability/page.tsx` with both search and graph visualization components.

### REQ-1.2.6: Minimal operator burden — data capture as automated as possible
**Status:** PARTIAL
**Evidence:** The operator station UI at `src/app/station/page.tsx` provides guided workflows. Material consumption dialogs assist with lot selection.
**Gap:** No barcode/QR scanning integration, no auto-population from edge devices, no IoT sensor data capture. All data entry appears to be manual form-based. The `EventSource` type includes `'edge'` but no edge integration exists.

---

## 1.3 Key User Roles

### REQ-1.3.1: Administrator — system config, user management, product/BOM management, form/field customization
**Status:** PARTIAL
**Evidence:** Admin role exists (`Role.admin`). Admin pages exist for: stations (`src/app/admin/stations/page.tsx`), quality checks (`src/app/admin/quality-checks/page.tsx`), downtime reasons (`src/app/admin/downtime-reasons/page.tsx`), work orders (`src/app/admin/work-orders/page.tsx`), materials (`src/app/admin/materials/page.tsx`), BOM (`src/app/admin/bom/page.tsx`), kitting (`src/app/admin/kitting/page.tsx`). User station assignment exists in `src/lib/actions/admin/users.ts`.
**Gap:** No full user management UI (create/edit/deactivate users beyond station assignment). No form/field customization system — admin cannot add custom fields without code changes.

### REQ-1.3.2: Buyer / Engineer — place purchase orders, upload drawings, define CTQ inspection dimensions, manage BOMs
**Status:** NOT_IMPLEMENTED
**Evidence:** No buyer/engineer role in the enum. No purchase order creation UI. No drawing upload functionality. BOM management exists under admin role. Quality check definition (CTQ-adjacent) exists but is admin-only.
**Gap:** This role and its unique capabilities (PO creation, drawing management) are entirely absent.

### REQ-1.3.3: Receiving Manager — match incoming shipments to open orders, initiate receiving records
**Status:** PARTIAL
**Evidence:** A `MaterialReceivingForm` component exists at `src/components/admin/MaterialReceivingForm.tsx` with corresponding server action at `src/lib/actions/material-receiving.ts`. The `MaterialLot` model has `receivedById`, `receivedAt`, `purchaseOrderNumber`, and `supplier` fields.
**Gap:** No dedicated receiving manager role. No PO matching workflow (no PurchaseOrder entity to match against). Receiving is accessible through admin, not a dedicated receiving interface. No shipment tracking model.

### REQ-1.3.4: Quality Inspector (IQC) — perform and record incoming inspections, disposition nonconforming material
**Status:** NOT_IMPLEMENTED
**Evidence:** Quality checks exist but are tied to in-process production stations, not incoming material inspection. The `MaterialLot` model has a `status` field with `'quarantine'` as an option, and the receiving form allows setting initial status to quarantine.
**Gap:** No IQC-specific workflow, inspection forms, or role. No incoming inspection records linked to material lots. No formal disposition workflow for incoming material (only production NCRs exist).

### REQ-1.3.5: Supply Chain / Inventory Manager — monitor inventory levels, manage kitting, respond to replenishment alerts
**Status:** PARTIAL
**Evidence:** Inventory dashboard exists at `src/app/dashboard/inventory/page.tsx`. Kitting management exists at `src/app/admin/kitting/page.tsx` with server actions at `src/lib/actions/kitting.ts`. Inventory actions at `src/lib/actions/inventory.ts` and adjustment at `src/lib/actions/inventory-adjustment.ts`.
**Gap:** No dedicated inventory manager role (falls under admin/supervisor). No replenishment alerts or reorder point system. No formal supply chain management features.

### REQ-1.3.6: Production Manager — create and manage work orders, monitor production status and yield
**Status:** IMPLEMENTED
**Evidence:** Work order management at `src/app/admin/work-orders/page.tsx` and `src/lib/actions/work-orders.ts`. Production dashboard at `src/app/dashboard/production/page.tsx`. OEE dashboard at `src/app/dashboard/oee/page.tsx`. Analytics at `src/app/dashboard/analytics/page.tsx`. WIP tracking at `src/app/dashboard/wip/page.tsx`. Shift reports at `src/app/dashboard/shift-report/page.tsx`. These functions are served through the supervisor/admin roles.

### REQ-1.3.7: Production Operator — record in-process data, scan parts, enter test results via mobile/web interface
**Status:** PARTIAL
**Evidence:** Operator role exists. Station pages at `src/app/station/page.tsx` and `src/app/station/[stationId]/page.tsx` provide operator workflows. Operator components in `src/components/operator/` include `ActiveUnit.tsx` and `MaterialConsumptionDialog.tsx`. Web interface is functional.
**Gap:** No barcode/part scanning integration. No dedicated mobile-optimized layout (responsive web only). Test result entry exists through quality checks but is not specialized for test stations.

### REQ-1.3.8: Shipping Coordinator — generate packing lists, labels, and shipping records for completed work orders
**Status:** NOT_IMPLEMENTED
**Evidence:** No shipping-related models, pages, components, or server actions found in the codebase.
**Gap:** Entire shipping module is absent — no packing lists, no shipping labels, no shipping records, no shipment tracking.

### REQ-1.3.9: Role granularity — 8 distinct user roles as specified
**Status:** NOT_IMPLEMENTED
**Evidence:** The system has 3 roles: `operator`, `supervisor`, `admin` (defined in `prisma/schema.prisma` enum `Role`). The RBAC system in `src/lib/auth/rbac.ts` enforces these 3 roles with hierarchy helpers.
**Gap:** 5 spec roles are missing: Buyer/Engineer, Receiving Manager, Quality Inspector (IQC), Supply Chain/Inventory Manager, Shipping Coordinator. The current 3-role model collapses these into admin/supervisor. This is a significant architectural gap requiring schema migration and RBAC refactoring.

---

## Risk Assessment

### High Priority Gaps
1. **Role model simplification (REQ-1.3.9):** The 3-role model vs. 8-role spec is a fundamental architectural difference that affects access control, UI routing, and workflow design across the entire system.
2. **Missing modules (REQ-1.3.2, 1.3.4, 1.3.8):** Procurement, IQC, and Shipping are entirely absent. These represent major feature development efforts.
3. **Extensibility limitations (REQ-1.2.3):** The lack of a custom fields system means every new data requirement needs code changes, violating the spec's "no development needed" principle.

### Medium Priority Gaps
4. **Incomplete traceability chain (REQ-1.1.2):** Missing receiving and shipping records break the "raw material to finished product" traceability promise.
5. **Single SKU in practice (REQ-1.1.4):** While the data model supports multiple SKUs, only one is configured.
6. **No automation integration (REQ-1.2.6):** All data capture is manual; no edge device, barcode scanner, or IoT integration.

### Low Priority Gaps
7. **Monolithic architecture (REQ-1.2.4):** Acceptable for Phase-1 MVP but noted as a gap against the "non-monolithic" spec language.
8. **No mobile-specific UI (REQ-1.3.7):** Web-responsive approach is reasonable for MVP.

---

## File References

| File | Relevance |
|------|-----------|
| `prisma/schema.prisma` | Core data model — 30+ models, 3-role enum |
| `src/lib/auth/rbac.ts` | RBAC enforcement with requireRole() |
| `src/lib/db/events.ts` | Event-driven architecture, 22 event types |
| `src/app/admin/` | Admin configuration pages (7 modules) |
| `src/app/station/` | Operator station UI |
| `src/app/dashboard/traceability/page.tsx` | Traceability search |
| `src/components/admin/MaterialReceivingForm.tsx` | Basic receiving form |
| `src/lib/actions/admin/quality-checks.ts` | Configurable quality checks |
| `prisma/seed.ts` | Demo data — single SKU only |
