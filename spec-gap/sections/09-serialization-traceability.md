# Section 9: Serialization and Traceability — Gap Analysis

**Spec Reference:** SPEC.md lines 642-704
**Analysis Date:** 2026-03-12
**Analyst:** Claude Opus 4.6

---

## Summary

Section 9 specifies a multi-level serialization system (no traceability, lot-level, unit-level), subassembly serial generation, configurable serial formats, and a comprehensive traceability record exportable as a PDF Certificate of Conformance. The codebase implements basic unit-level serialization with a simple prefix+sequence format and provides a functional traceability search with list and graph views. However, configurable serialization levels, subassembly serials, advanced serial formats, laser engraver integration, PDF CoC export, and date-range/WO-based traceability queries are all missing.

| Status | Count |
|--------|-------|
| IMPLEMENTED | 4 |
| PARTIAL | 5 |
| NOT_IMPLEMENTED | 8 |

---

## 9.1 Serialization Levels

### REQ-9.1.1: Three serialization levels configurable per part — no traceability, lot-level, unit-level
**Status:** NOT_IMPLEMENTED
**Evidence:** The system only supports unit-level serialization. Every `Unit` record receives a unique `serialNumber` (`prisma/schema.prisma` line 250). There is no concept of "no traceability" or "lot-level only" tracking modes. The `BillOfMaterial` model has no `traceabilityLevel` or equivalent field.
**Gap:** No per-part configurable traceability level. No ability to track some components by lot only (batch traceability) while tracking others by individual serial. This is a data model and workflow gap — requires adding a traceability level field to BOM items or a part master entity.

### REQ-9.1.2: Lot-level traceability — link material lot numbers to units consumed
**Status:** IMPLEMENTED
**Evidence:** `UnitMaterialConsumption` model (`prisma/schema.prisma` lines 321-339) links units to material lots with quantity, station, operator, and timestamp. The `MaterialLot` model tracks lot numbers with supplier, PO, and quantity data. The traceability search at `src/components/supervisor/TraceabilitySearch.tsx` displays material genealogy for a unit and consumption history for a lot.

### REQ-9.1.3: Unit-level traceability — unique serial number per unit with full production history
**Status:** IMPLEMENTED
**Evidence:** The `Unit` model has a unique `serialNumber` field. `getUnitWithHistory()` in `src/lib/actions/units.ts` (line 339) fetches the complete unit record including executions, material consumptions, quality results, and NCRs. The traceability graph component at `src/components/supervisor/TraceabilityGraph.tsx` provides visual genealogy.

---

## 9.2 Subassembly Serial Numbers

### REQ-9.2.1: Subassembly serial numbers generated at subassembly completion + inspection pass (Stator, Rotor, Wire Harness, Base)
**Status:** NOT_IMPLEMENTED
**Evidence:** No subassembly model or subassembly serial generation exists. The system tracks only the final motor unit. Station completion (`completeOperation` in `src/lib/actions/units.ts`) does not generate intermediate serials.
**Gap:** Entire subassembly serialization concept is absent. Requires a new model (e.g., `SubAssembly`) linked to units, with serial generation triggered by operation completion at subassembly stations.

### REQ-9.2.2: Configurable serial format per subassembly type
**Status:** NOT_IMPLEMENTED
**Evidence:** No subassembly-specific serial format configuration exists. The only serial format config is the site-level `serialPrefix` and `serialLength` in `site.config` JSON (`prisma/seed.ts` line 70).
**Gap:** No per-type format configuration. Would need a configuration entity or extension of the routing/station config to define serial formats per subassembly type.

---

## 9.3 Serial Number Entry Methods

### REQ-9.3.1: Manual keyboard entry for serial numbers
**Status:** IMPLEMENTED
**Evidence:** `CreateUnitDialog` at `src/components/operator/CreateUnitDialog.tsx` provides a text input for manual serial number entry (line 70-83). The serial is optional — blank defaults to auto-generation.

### REQ-9.3.2: Barcode/QR scan entry for serial numbers
**Status:** PARTIAL
**Evidence:** The `CreateUnitDialog` UI text says "Scan a barcode or enter manually" (line 81), and the `MaterialConsumptionDialog` says "Search or Scan Lot Number" (line 224). However, there is no actual barcode/QR scanning integration — no camera access, no scanner device API, no barcode parsing library.
**Gap:** The UI hints at scanning capability but relies on external barcode scanners that type into the text field (keyboard wedge mode). No native camera-based scanning or dedicated scanner integration.

### REQ-9.3.3: Automatic serial assignment from kit
**Status:** PARTIAL
**Evidence:** Auto-generation exists via `generateSerialNumber()` in `src/lib/actions/units.ts` (line 13) using a prefix + sequential counter format. Kits exist (`Kit`, `KitLine` models) but kit-issued serials are not automatically applied to units.
**Gap:** Kit lines track material lots but do not carry or auto-assign serial numbers to units. No workflow connects kit issuance to serial number population.

---

## 9.4 Motor Final Serial Number

### REQ-9.4.1: Final serial number generated on EOL test pass
**Status:** NOT_IMPLEMENTED
**Evidence:** Serial numbers are assigned at unit creation time (`createUnit` in `src/lib/actions/units.ts`), not at EOL test pass. There is no conditional serial generation tied to final test results. Units that ultimately fail can still have serial numbers.
**Gap:** The serial number lifecycle is inverted from the spec. The spec requires serial assignment as a gate after EOL pass; the implementation assigns serials at the start of production. This is a fundamental workflow difference.

### REQ-9.4.2: Configurable serial format — numeric sequential, date-coded, model-coded, custom prefix/suffix
**Status:** PARTIAL
**Evidence:** `generateSerialNumber()` in `src/lib/actions/units.ts` (line 13-33) supports configurable prefix (`serialPrefix`) and length (`serialLength`) from site config. The format is strictly `{prefix}-{zero-padded-sequence}` (e.g., `MTR-00000001`).
**Gap:** No date-coded format, no model-coded format, no custom suffix. Only one format pattern is supported (prefix + sequential). The format is site-wide, not per product or per motor model.

### REQ-9.4.3: Serial number transmitted to laser engraver
**Status:** NOT_IMPLEMENTED
**Evidence:** No laser engraver integration, no engraving API, no external device communication found anywhere in the codebase.
**Gap:** Entire laser engraver integration is absent. Would require a device integration layer (possibly via the `'edge'` event source).

### REQ-9.4.4: Engraving confirmation recorded as event
**Status:** NOT_IMPLEMENTED
**Evidence:** No `engraving_confirmed` or similar event type exists. The event taxonomy in `src/lib/db/events.ts` does not include any engraving-related events.
**Gap:** No engraving confirmation workflow or event.

---

## 9.5 Full Traceability Record

### REQ-9.5.1: Traceability record includes motor serial, model, WO, BOM revision
**Status:** PARTIAL
**Evidence:** `getUnitWithHistory()` in `src/lib/actions/units.ts` returns the unit with `workOrder` (including `orderNumber`, `productCode`), and `serialNumber`. The traceability search UI displays serial, work order, and product code.
**Gap:** No BOM revision tracking. The `BillOfMaterial` model has no `revision` field. The `Routing` model has no version/revision tracking.

### REQ-9.5.2: Traceability record includes EOL test results
**Status:** PARTIAL
**Evidence:** Quality check results are included in the traceability record (`qualityResults` in `getUnitWithHistory()`). Some quality checks are configured for test stations (e.g., "Electrical Test - Insulation", "Final Test - RPM", "Final Test - Current Draw" in seed data).
**Gap:** No dedicated EOL test model or structured test result format. Quality checks at test stations serve as a proxy but lack the structured parameter-by-parameter pass/fail breakdown that a formal EOL test record would provide.

### REQ-9.5.3: Traceability record includes subassembly serials + component lots/serials
**Status:** PARTIAL
**Evidence:** Component lot consumptions are tracked via `UnitMaterialConsumption` and displayed in the traceability search (material genealogy section).
**Gap:** No subassembly serials (subassembly model does not exist). Component-level individual serial tracking is not implemented — only lot-level consumption.

### REQ-9.5.4: Traceability record includes all measurements, operators, timestamps
**Status:** IMPLEMENTED
**Evidence:** `UnitOperationExecution` records operators and timestamps for each operation. `QualityCheckResult` stores `valuesJson` with measurement data, operator, and timestamp. `UnitMaterialConsumption` records operator and timestamp. All are included in `getUnitWithHistory()`.

### REQ-9.5.5: Traceability record includes all NCRs
**Status:** IMPLEMENTED
**Evidence:** NCRs are included in `getUnitWithHistory()` via the `ncrs` relation. The traceability search UI displays NCRs with defect type, station, status, and disposition.

### REQ-9.5.6: Traceability record includes shipping record
**Status:** NOT_IMPLEMENTED
**Evidence:** No shipping model or shipping record exists anywhere in the codebase.
**Gap:** Entire shipping module is absent.

### REQ-9.5.7: Exportable as PDF Certificate of Conformance (CoC)
**Status:** NOT_IMPLEMENTED
**Evidence:** No PDF generation capability exists. No CoC template, no PDF library (e.g., `@react-pdf/renderer`, `puppeteer`, `pdfkit`) in the codebase or dependencies.
**Gap:** PDF CoC generation is entirely absent. Would require a PDF generation library, a CoC template design, and a server action or API route to generate and serve the document.

---

## 9.6 Traceability Query

### REQ-9.6.1: Search by serial number
**Status:** IMPLEMENTED
**Evidence:** `TraceabilitySearch` component at `src/components/supervisor/TraceabilitySearch.tsx` supports serial number search via `searchUnitBySerial()` in `src/lib/actions/units.ts`.

### REQ-9.6.2: Search by lot number
**Status:** IMPLEMENTED
**Evidence:** `TraceabilitySearch` supports lot number search via `searchMaterialLot()` in `src/lib/actions/materials.ts`. Results show all units that consumed the lot (reverse traceability).

### REQ-9.6.3: Search by work order number
**Status:** NOT_IMPLEMENTED
**Evidence:** The traceability search only supports serial number and lot number search types. No WO-based search option exists.
**Gap:** No work order search in the traceability interface. WO data is visible once a unit is found but cannot be used as a search entry point.

### REQ-9.6.4: Search by date range
**Status:** NOT_IMPLEMENTED
**Evidence:** No date range filter or date-based search in the traceability interface.
**Gap:** No temporal filtering capability in traceability queries.

### REQ-9.6.5: Display full genealogy with graph visualization
**Status:** IMPLEMENTED
**Evidence:** `TraceabilityGraph` component at `src/components/supervisor/TraceabilityGraph.tsx` renders an SVG-based genealogy graph showing the unit as a central node connected to operations, materials, quality checks, and NCRs. The graph supports hover highlighting and click-to-inspect details.

### REQ-9.6.6: Flag quality events in traceability display
**Status:** IMPLEMENTED
**Evidence:** NCRs are displayed with red color coding in both the list view and graph view. Quality check failures are shown with red badges. The graph uses color-coded nodes (green for pass, red for fail/NCR).

---

## Risk Assessment

### High Priority Gaps
1. **Serial number lifecycle inversion (REQ-9.4.1):** Serials are assigned at unit creation, not at EOL pass. This is a fundamental workflow difference from spec that affects quality gating and the meaning of a serial number.
2. **No subassembly serialization (REQ-9.2.1-9.2.2):** The entire subassembly serial tracking concept is absent, breaking intermediate traceability for stators, rotors, wire harnesses, and bases.
3. **No PDF CoC export (REQ-9.5.7):** Certificate of Conformance generation is a common customer/regulatory requirement that is entirely missing.

### Medium Priority Gaps
4. **No configurable traceability levels (REQ-9.1.1):** All parts are tracked at unit level only — no lot-only or no-traceability options.
5. **Limited serial format options (REQ-9.4.2):** Only prefix+sequential format; no date-coded or model-coded variants.
6. **Incomplete traceability query (REQ-9.6.3-9.6.4):** Missing WO search and date range filtering limits usability for batch investigations.

### Low Priority Gaps
7. **Laser engraver integration (REQ-9.4.3-9.4.4):** Hardware integration is expected to be Phase 2+.
8. **No BOM revision tracking (REQ-9.5.1):** Important for regulated industries but not critical for MVP demo.

---

## File References

| File | Relevance |
|------|-----------|
| `prisma/schema.prisma` | Unit model with serialNumber, MaterialLot, UnitMaterialConsumption |
| `src/lib/actions/units.ts` | generateSerialNumber(), createUnit(), getUnitWithHistory() |
| `src/components/supervisor/TraceabilitySearch.tsx` | Traceability search UI — serial and lot search |
| `src/components/supervisor/TraceabilityGraph.tsx` | SVG genealogy graph visualization |
| `src/app/dashboard/traceability/page.tsx` | Traceability page entry point |
| `src/components/operator/CreateUnitDialog.tsx` | Serial number entry UI (manual + auto-generate) |
| `src/lib/actions/materials.ts` | searchMaterialLot() for lot-based traceability |
| `src/lib/actions/quality.ts` | Quality check recording, linked to traceability |
| `prisma/seed.ts` | Serial config (MTR prefix), quality check definitions |
