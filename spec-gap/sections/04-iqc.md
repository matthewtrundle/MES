# Section 04: Incoming Quality Control (IQC)

## Source: Spec sections 4.1-4.7

## Requirements

| ID | Requirement | Status | Evidence | Gap Size |
|----|------------|--------|----------|----------|
| 4.1-01 | Dedicated IQC module for incoming parts inspection | NOT_IMPLEMENTED | No IQC-specific module exists. Quality checks are in-process (station-based), not incoming-focused. `QualityCheckDefinition` is tied to `stationIds`, not to receiving/part numbers. | L |
| 4.1-02 | Guide inspector through dimensional inspections of received parts | NOT_IMPLEMENTED | `QualityCheckDialog.tsx` supports measurement checks but is designed for in-process station use, not incoming parts inspection. No dimensional inspection workflow for received lots. | L |
| 4.1-03 | Guide inspector through attribute inspections of received parts | NOT_IMPLEMENTED | Pass/fail and checklist check types exist (`quality-checks.ts`) but are station-bound, not linked to received material lots or part numbers. | L |
| 4.1-04 | Inspection before inventory admission | NOT_IMPLEMENTED | `receiveMaterialLot()` in `material-receiving.ts` admits lots directly to `available` or `quarantine` status. No inspection gate between receiving and inventory admission. | M |
| 4.2-01 | Auto-create IQC record on receiving event | NOT_IMPLEMENTED | `receiveMaterialLot()` emits `material_lot_received` event but no listener or trigger creates an inspection record. No IQC record model exists. | M |
| 4.2-02 | Notify inspector on receiving event | NOT_IMPLEMENTED | No notification system for quality inspectors on receipt. | S |
| 4.2-03 | Pending inspection queue for inspectors | NOT_IMPLEMENTED | No queue UI or data model for pending incoming inspections. | M |
| 4.3-01 | CTQ dimension definitions per part number/revision | NOT_IMPLEMENTED | `QualityCheckDefinition` has `name`, `checkType`, `parameters` but no part-number or revision linkage. No CTQ-specific schema (nominal, USL, LSL). | L |
| 4.3-02 | Dimension name, nominal, USL, LSL fields | PARTIAL | `MeasurementParameters` type has `min`, `max`, `target` (analogous to LSL, USL, nominal) but lacks explicit naming convention. No `dimensionName` field. No USL/LSL terminology. | M |
| 4.3-03 | Measurement tool specification per CTQ | NOT_IMPLEMENTED | No field for measurement tool (caliper, CMM, etc.) in `QualityCheckDefinition` or its parameters. | XS |
| 4.3-04 | Method note per CTQ | NOT_IMPLEMENTED | No method/instruction note field on check definitions. | XS |
| 4.3-05 | Sample size rule per CTQ | NOT_IMPLEMENTED | No sample size configuration. Each check is executed once per unit; no sampling plan (e.g., AQL-based). | M |
| 4.3-06 | Safety-critical flag on CTQ dimensions | NOT_IMPLEMENTED | No safety-critical or critical-to-quality flag on `QualityCheckDefinition`. | XS |
| 4.3-07 | Revision-controlled CTQ definitions | NOT_IMPLEMENTED | `QualityCheckDefinition` has no revision/version tracking. Updates overwrite in place. | M |
| 4.3-08 | Copy CTQ definitions between revisions | NOT_IMPLEMENTED | No revision model, so no copy-between-revisions capability. | S |
| 4.4-01 | Drawing-based CTQ extraction (semi-auto, AI/OCR) | DEFERRED | Spec explicitly states "not required for launch but architecturally supported." No PDF upload, OCR, or AI extraction capability exists. | L |
| 4.4-02 | Human confirmation of extracted CTQs | DEFERRED | Dependent on 4.4-01. No confirmation UI. | S |
| 4.5-01 | Display part info + drawing during inspection | NOT_IMPLEMENTED | `QualityCheckDialog.tsx` shows check name/type but no part info, drawing reference, or embedded drawing viewer. | M |
| 4.5-02 | Display sample size during inspection | NOT_IMPLEMENTED | No sample size shown; single-measurement flow only. | S |
| 4.5-03 | One CTQ at a time inspection flow | PARTIAL | Dialog shows one check at a time (select then execute), but the flow is per quality check definition, not per CTQ dimension within a structured inspection. | S |
| 4.5-04 | Multi-sample measurement recording | NOT_IMPLEMENTED | Single measurement value per check. No multi-sample input (e.g., measure 5 samples and record each). | M |
| 4.5-05 | Inspector identity tracking per measurement | IMPLEMENTED | `QualityCheckResult` records `operatorId` (inspector). `quality.ts` captures `user.id` via `requireUser()`. | -- |
| 4.5-06 | Timestamp tracking per measurement | IMPLEMENTED | `QualityCheckResult.timestamp` auto-set via `@default(now())`. | -- |
| 4.6-01 | Conforming disposition | NOT_IMPLEMENTED | No IQC-specific disposition. Existing NCR dispositions are `rework | scrap | use_as_is | defer`, which map to nonconforming outcomes only. No explicit "conforming/accept" result that releases lot to inventory. | M |
| 4.6-02 | Nonconforming-Rework disposition | PARTIAL | NCR disposition supports `rework`, but this is tied to in-process units (`Unit` model), not incoming material lots (`MaterialLot`). | M |
| 4.6-03 | Nonconforming-UAI disposition with engineer sign-off | NOT_IMPLEMENTED | `use_as_is` disposition exists but no engineer sign-off requirement. No secondary approval workflow. | M |
| 4.6-04 | Nonconforming-Scrap disposition | PARTIAL | NCR disposition supports `scrap`, but linked to units, not material lots. | S |
| 4.6-05 | Permanent records linked to receiving/lot | NOT_IMPLEMENTED | `QualityCheckResult` links to `Unit`, not `MaterialLot`. No traceability from inspection result to receiving event or lot record. | L |
| 4.7-01 | NCR number generation for IQC | NOT_IMPLEMENTED | `NonconformanceRecord` uses UUID `id`, not a human-readable sequential NCR number (e.g., NCR-2026-0042). | S |
| 4.7-02 | NCR linked to PO/receiving record | NOT_IMPLEMENTED | `NonconformanceRecord` links to `Unit` and `Station`, not to `MaterialLot` or purchase order. | M |
| 4.7-03 | NCR captures part number, revision, lot, quantity | NOT_IMPLEMENTED | NCR has `defectType` and `description` (free text) but no structured fields for part number, revision, lot number, or affected quantity. | M |
| 4.7-04 | NCR captures failed dimensions | NOT_IMPLEMENTED | No structured link from NCR to specific failed CTQ dimensions. Failure info is embedded in `description` as free text. | M |
| 4.7-05 | NCR disposition rationale field | NOT_IMPLEMENTED | No rationale/justification text field on disposition. Disposition is a bare enum value (`rework`, `scrap`, etc.). | S |
| 4.7-06 | Corrective action: text + responsible party + due date | NOT_IMPLEMENTED | No corrective action model or fields. NCR has `description` only. | M |
| 4.7-07 | Supplier notification status tracking | NOT_IMPLEMENTED | No supplier notification tracking. `MaterialLot.supplier` is a text field with no notification workflow. | S |
| 4.7-08 | Resolution date and outcome tracking | PARTIAL | `NonconformanceRecord.closedAt` tracks closure date. `disposition` tracks outcome. But no resolution-specific fields (resolution notes are appended to `description`). | S |

## Coverage Summary

- **Total Requirements**: 32
- **IMPLEMENTED**: 2 (6%)
- **PARTIAL**: 5 (16%)
- **NOT_IMPLEMENTED**: 23 (72%)
- **DEFERRED**: 2 (6%)

**Overall IQC Coverage: ~14%**

The IQC module is fundamentally absent from the codebase. The existing quality infrastructure was built for **in-process quality checks** at production stations, not for **incoming material inspection**. The two key structural gaps are:

1. **No IQC data model**: There is no `IncomingInspection` or `IQCRecord` entity linking quality checks to `MaterialLot` records. The existing `QualityCheckResult` is tied to `Unit` (production units), not to incoming material lots.

2. **No CTQ dimension model**: `QualityCheckDefinition` is a generic check container. It lacks the per-part-number, revision-controlled, dimensionally-rich structure (nominal/USL/LSL, measurement tool, sample size, safety-critical flag) required by the spec.

## Gaps (Detail)

### GAP-IQC-01: IQC Data Model & Inspection Lifecycle (Size: XL)
**Spec refs**: 4.1-01, 4.1-04, 4.2-01, 4.2-03, 4.6-01, 4.6-05
**Description**: No IQC-specific data model exists. Need new Prisma models:
- `IncomingInspection` (linked to `MaterialLot`, with status: pending/in_progress/completed/rejected)
- `IQCResult` (linked to `IncomingInspection` + `CTQDefinition`, with measured values per sample)
- Trigger/listener on `material_lot_received` event to auto-create inspection record
- Inspection queue page for quality inspectors
- Conforming disposition that releases lot from quarantine to available
**Files affected**: `prisma/schema.prisma`, new `src/lib/actions/iqc.ts`, new `src/app/quality/iqc/` pages

### GAP-IQC-02: CTQ Dimension Definition Model (Size: L)
**Spec refs**: 4.3-01 through 4.3-08
**Description**: Need a `CTQDefinition` model per part-number/revision with:
- `partNumber`, `revision`, `dimensionName`
- `nominal`, `usl`, `lsl`, `measurementTool`, `methodNote`
- `sampleSizeRule` (e.g., AQL level, fixed count)
- `safetyCritical` boolean flag
- Revision control (immutable per revision, copy-forward on new revision)
**Files affected**: `prisma/schema.prisma`, new `src/lib/actions/admin/ctq-definitions.ts`, new admin UI pages

### GAP-IQC-03: Inspection Execution UI (Size: L)
**Spec refs**: 4.5-01 through 4.5-04
**Description**: Build inspector-facing UI:
- Show part info, drawing reference, sample size
- Step through CTQs one at a time
- Multi-sample measurement input (e.g., 5 readings per CTQ)
- Auto-evaluate pass/fail against USL/LSL
- Inspector identity and timestamp per measurement (already partially supported)
**Files affected**: New components in `src/components/quality/`, new pages in `src/app/quality/iqc/`

### GAP-IQC-04: IQC-Specific NCR Fields (Size: M)
**Spec refs**: 4.7-01 through 4.7-08
**Description**: Extend `NonconformanceRecord` or create IQC-specific NCR model with:
- Human-readable NCR number (sequential)
- Links to PO, receiving record, material lot
- Structured fields: part number, revision, lot, affected qty, failed dimensions
- Disposition rationale text field
- Corrective action sub-model (text, responsible party, due date)
- Supplier notification status
- Resolution date/outcome (beyond current `closedAt`)
**Files affected**: `prisma/schema.prisma`, `src/lib/actions/quality.ts`, NCR UI components

### GAP-IQC-05: Drawing-Based CTQ Extraction (Size: L) [DEFERRED]
**Spec refs**: 4.4-01, 4.4-02
**Description**: Semi-automated extraction of CTQ dimensions from PDF engineering drawings using AI/OCR. Spec says "not required for launch but architecturally supported." Current architecture has no PDF handling or AI extraction pipeline. Should ensure CTQ model can accept both manual and auto-extracted entries.
**Files affected**: Future module; ensure CTQ model has `source` field (manual/extracted)

### GAP-IQC-06: Inspector Notification on Receiving (Size: S)
**Spec ref**: 4.2-02
**Description**: No notification mechanism when material is received. Could be implemented as an in-app notification badge, email, or event-driven push. Depends on a notification infrastructure that does not yet exist.
**Files affected**: New notification system (cross-cutting concern)
