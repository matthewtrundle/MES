# Section 11: Shipping and Fulfillment — Gap Analysis

**Spec Reference:** SPEC.md lines 754-791
**Analysis Date:** 2026-03-12
**Analyst:** Claude Opus 4.6

---

## Summary

Section 11 specifies a complete shipping and fulfillment module covering shipping eligibility gating, packing list generation, shipping label generation with carrier API integration, Certificate of Conformance PDF generation, and immutable shipping records that transition motors and work orders to a Shipped status. **The codebase has zero implementation of any shipping or fulfillment functionality.** No shipping models, pages, components, server actions, API routes, or event types exist. This is an entirely greenfield module.

| Status | Count |
|--------|-------|
| IMPLEMENTED | 0 |
| PARTIAL | 0 |
| NOT_IMPLEMENTED | 12 |

---

## 11.1 Shipping Eligibility

### REQ-11.1.1: Work order eligible for shipping when all units pass EOL test
**Status:** NOT_IMPLEMENTED
**Evidence:** No shipping eligibility check exists. The `WorkOrder` model tracks `qtyCompleted` and `status` (pending, released, in_progress, completed, cancelled) but has no `shipped` status or shipping-readiness check. The `completeOperation()` function in `src/lib/actions/units.ts` increments `qtyCompleted` when the last operation passes, but does not evaluate shipping eligibility.
**Gap:** No concept of shipping eligibility. No function checks whether all units in a work order have passed EOL. No `shipped` or `ready_to_ship` status value on WorkOrder or Unit models.

### REQ-11.1.2: Packaging must be complete before shipping
**Status:** NOT_IMPLEMENTED
**Evidence:** No packaging station, packaging step, or packaging status exists in the system. The routing ends at "Final Test" (Station F, sequence 6). No packaging-related models or workflows.
**Gap:** Entire packaging concept is absent. Would need a packaging station type, packaging completion tracking, and a gate that prevents shipping until packaging is confirmed.

---

## 11.2 Packing List Generation

### REQ-11.2.1: Packing list includes company info, customer info, ship date
**Status:** NOT_IMPLEMENTED
**Evidence:** No packing list model, template, or generation logic exists. No customer entity or customer information fields exist on any model (WorkOrder has no customer reference).
**Gap:** No packing list functionality. Also missing prerequisite: a Customer model or customer fields on WorkOrder.

### REQ-11.2.2: Packing list includes motor model, quantity, serial numbers
**Status:** NOT_IMPLEMENTED
**Evidence:** While the data exists (WorkOrder has productCode, Unit has serialNumber, qtyCompleted is tracked), there is no packing list document that aggregates this information.
**Gap:** The data is available but no document generation or packing list view exists.

### REQ-11.2.3: Packing list includes box count, weight, special handling notes
**Status:** NOT_IMPLEMENTED
**Evidence:** No packaging dimensions, weight, box count, or special handling fields exist on any model.
**Gap:** No physical packaging metadata. Would require new fields on a Shipment or PackingList model.

---

## 11.3 Shipping Label Generation

### REQ-11.3.1: Standard carrier format shipping labels
**Status:** NOT_IMPLEMENTED
**Evidence:** No shipping label generation, no label template, no label printing integration.
**Gap:** Entire label generation system is absent.

### REQ-11.3.2: Carrier API integration (UPS, FedEx, USPS)
**Status:** NOT_IMPLEMENTED
**Evidence:** No carrier API integration. No shipping-related API routes. No carrier SDK packages in dependencies. No environment variables for carrier API keys.
**Gap:** Carrier integration is entirely absent. Would require third-party SDK integration (e.g., EasyPost, ShipStation, or direct UPS/FedEx/USPS APIs), API key management, and rate/label request workflows.

---

## 11.4 Certificate of Conformance

### REQ-11.4.1: PDF Certificate of Conformance generation
**Status:** NOT_IMPLEMENTED
**Evidence:** No PDF generation capability exists anywhere in the codebase. No PDF libraries (`@react-pdf/renderer`, `pdfkit`, `puppeteer`, `jspdf`) in package.json. No CoC template or document generation server action.
**Gap:** Entire PDF generation infrastructure is absent. A CoC would need to aggregate: motor serial numbers, model info, WO number, BOM revision, all EOL test results, subassembly serials, material lot traceability, quality check history, and operator/date information. This overlaps significantly with the traceability record (Section 9.5).

---

## 11.5 Shipping Record

### REQ-11.5.1: Immutable shipping record creation
**Status:** NOT_IMPLEMENTED
**Evidence:** No `Shipment` or `ShippingRecord` model exists in `prisma/schema.prisma`. No shipping-related event types in the event taxonomy.
**Gap:** A new Prisma model is needed. Suggested fields based on spec: id, workOrderId, shipDate, carrier, trackingNumber, customerId/customerName, serialNumbers (array or relation), packingListUrl, cocUrl, status, createdAt. Corresponding immutable event: `shipment_created`.

### REQ-11.5.2: Shipping record includes ship date, carrier, tracking number
**Status:** NOT_IMPLEMENTED
**Evidence:** No carrier or tracking number fields on any model.
**Gap:** New fields on the shipping record model.

### REQ-11.5.3: Shipping record includes customer and serial numbers
**Status:** NOT_IMPLEMENTED
**Evidence:** No customer entity exists. Serial numbers are tracked on units but not aggregated into shipping records.
**Gap:** Need a Customer model or customer fields, plus a link between the shipping record and the specific units/serials shipped.

### REQ-11.5.4: Shipping record includes packing list PDF and CoC PDF
**Status:** NOT_IMPLEMENTED
**Evidence:** No PDF document storage. No file storage integration.
**Gap:** Requires both PDF generation (Section 11.2 and 11.4) and file storage (S3, database blob, or filesystem) to persist generated documents.

### REQ-11.5.5: Shipping transitions motors and work order to Shipped status
**Status:** NOT_IMPLEMENTED
**Evidence:** The `Unit` model status enum is: created, in_progress, completed, scrapped, rework. No `shipped` status. The `WorkOrder` status enum is: pending, released, in_progress, completed, cancelled. No `shipped` status.
**Gap:** Both the Unit and WorkOrder status enums need a `shipped` value. The shipping action would need to update all included units to `shipped` status and, if all units are shipped, transition the work order to `shipped`.

---

## Risk Assessment

### High Priority Gaps
1. **Entire module is absent:** Shipping and fulfillment is a complete greenfield build. No models, no UI, no server actions, no events — everything must be built from scratch.
2. **No Customer model (REQ-11.2.1, 11.5.3):** A prerequisite entity that does not exist. WorkOrders have no customer reference, which is also a gap for work order management generally.
3. **No PDF generation infrastructure (REQ-11.4.1):** Needed for both packing lists and CoC documents. This is a shared dependency that also blocks Section 9 (REQ-9.5.7).

### Medium Priority Gaps
4. **No `shipped` status on Unit/WorkOrder (REQ-11.5.5):** Schema migration required to add status values. Affects unit lifecycle and work order lifecycle state machines throughout the codebase.
5. **No carrier API integration (REQ-11.3.2):** Third-party integration requiring API keys, SDK setup, and error handling. Can be deferred if labels are generated externally.

### Low Priority Gaps
6. **Physical packaging metadata (REQ-11.2.3):** Box count, weight, etc. are operational details that could be added later.

---

## Implementation Roadmap (Suggested)

Given that this is an entirely absent module, implementation would require:

1. **Schema additions:**
   - `Customer` model (id, name, address, contactEmail, etc.)
   - `Shipment` model (id, workOrderId, customerId, shipDate, carrier, trackingNumber, packingListUrl, cocUrl, status, createdAt)
   - Add `shipped` to Unit status and WorkOrder status enums
   - Add `customerId` to WorkOrder model

2. **Server actions:**
   - `createShipment()` — validate eligibility, generate packing list PDF, generate CoC PDF, create immutable shipment record, emit events, transition statuses
   - `getShipmentsByWorkOrder()`
   - `getShipmentByTracking()`

3. **Event types:**
   - `shipment_created`
   - `packing_list_generated`
   - `coc_generated`

4. **UI:**
   - Shipping dashboard page
   - Ship work order dialog with carrier/tracking entry
   - Packing list preview/download
   - CoC preview/download
   - Shipping history in traceability view

5. **Infrastructure:**
   - PDF generation library (e.g., `@react-pdf/renderer` or `pdfkit`)
   - File storage for generated PDFs
   - Optional: carrier API integration

---

## File References

| File | Relevance |
|------|-----------|
| `prisma/schema.prisma` | Missing Shipment/Customer models; Unit and WorkOrder status enums need `shipped` |
| `src/lib/actions/units.ts` | completeOperation() — endpoint of current lifecycle, no shipping transition |
| `src/lib/db/events.ts` | No shipping event types defined |
| `src/lib/actions/work-orders.ts` | Work order lifecycle — no shipping status transition |
| `src/app/dashboard/traceability/page.tsx` | Traceability display — would need shipping record section |
| `src/components/supervisor/TraceabilitySearch.tsx` | Would need to display shipping info in unit history |
