# Section 8: In-Process Production Data Capture -- Gap Analysis

## Summary

| Status          | Count |
|-----------------|-------|
| Implemented     | 19    |
| Partially Implemented | 12 |
| Not Implemented | 23    |
| **Total**       | **54** |

---

## 8.1 Operator Interfaces for Recording Data at Each Manufacturing Step

### 8.1-01: Operator interface exists for recording data at each manufacturing step
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `src/app/station/[stationId]/page.tsx` provides a per-station operator page with active unit display, pass/fail recording, quality checks, and material consumption. However, the data captured is limited to pass/fail result and optional notes -- there are no configurable per-step data fields (measurements, checkbox lists, file uploads, etc.).
- **Gap**: No rich, step-specific data field capture. Only generic pass/fail + notes per operation.

### 8.1-02: Process categories defined (Stator Production, Stator Electrical Assembly, Wire Harness, Base Assembly, Rotor Assembly, Final Assembly, Packaging)
- **Status**: NOT IMPLEMENTED
- **Evidence**: Station types in schema are generic: `winding | assembly | test | inspection`. Seed data uses generic station names (Winding, Magnet Install, Housing Assembly, etc.). No concept of the seven spec-defined process categories exists anywhere in the codebase.
- **Gap**: Need a `processCategory` field on Station or a separate ProcessCategory entity matching the seven spec categories.

### 8.1-03: Each process category has its own set of configurable steps
- **Status**: NOT IMPLEMENTED
- **Evidence**: The Routing model stores operations as a JSON array of `{ stationId, sequence, estimatedMinutes }`. There is no concept of named steps within a category, nor per-step data field configuration.
- **Gap**: Need a ProcessStep or OperationDefinition model with per-step configurable fields.

---

## 8.2 Process Step Configuration

### 8.2-01: Admin can configure process steps
- **Status**: NOT IMPLEMENTED
- **Evidence**: No admin UI for creating/editing process step definitions. Steps are implicitly defined by routing operations (station + sequence), but with no configurable attributes beyond `estimatedMinutes`.
- **Gap**: Need an admin CRUD interface for process step definitions.

### 8.2-02: Step name and description configurable
- **Status**: NOT IMPLEMENTED
- **Evidence**: `WorkOrderOperation` has no `name` or `description` field. Operations are identified only by station + sequence number. The operator UI shows "Step {sequence}" with no descriptive name.
- **Gap**: Add name/description to operation definition or create a ProcessStep model.

### 8.2-03: Process category / workstation assignment per step
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: Each `WorkOrderOperation` links to a `stationId`, so workstation assignment exists. But there is no process category assignment.
- **Gap**: Add process category linkage.

### 8.2-04: Sequence order configurable per step
- **Status**: IMPLEMENTED
- **Evidence**: `WorkOrderOperation.sequence` (Int) defines ordering. Routing operations JSON also includes `sequence`. `@@unique([workOrderId, sequence])` enforces uniqueness.

### 8.2-05: Step marked as mandatory or optional
- **Status**: NOT IMPLEMENTED
- **Evidence**: No `mandatory` or `optional` flag on `WorkOrderOperation` or any step definition. All operations are implicitly mandatory since the unit advances through all of them in sequence.
- **Gap**: Add `isMandatory` boolean to step/operation configuration.

### 8.2-06: Configurable data fields per step (name, type, unit of measure, pass/fail limits)
- **Status**: NOT IMPLEMENTED
- **Evidence**: `UnitOperationExecution` captures only `result` (pass/fail/rework), `notes` (free text), and `cycleTimeMinutes`. No mechanism for admin-defined data fields with types, units of measure, or pass/fail limits per step. Quality check definitions (`QualityCheckDefinition`) have `parameters` JSON with min/max/nominal values, but these are separate from the operation step itself and not linked per-step.
- **Gap**: Need a step-level data field definition model (OperationFieldDefinition) and corresponding captured-values storage on UnitOperationExecution.

### 8.2-07: Operator sign-off requirement per step
- **Status**: NOT IMPLEMENTED
- **Evidence**: No sign-off concept exists. Operations are completed by any authenticated user without explicit signature or sign-off confirmation. The operator who started vs completed an operation is tracked, but no formal sign-off is enforced.
- **Gap**: Add `requiresSignOff` flag and sign-off recording mechanism.

### 8.2-08: QC disposition trigger configurable per step
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `QualityCheckDefinition` can be associated with station IDs via `stationIds` array, and quality check failure auto-creates an NCR (`quality.ts` line 86-96). However, this is not configurable per operation step -- it is per station. There is no admin toggle to control which steps trigger QC disposition.
- **Gap**: Need per-step QC trigger configuration, not just per-station quality check definitions.

### 8.2-09: Cycle time target configurable per step
- **Status**: IMPLEMENTED
- **Evidence**: `WorkOrderOperation.estimatedMinutes` stores cycle time target per operation. The operator UI (`ActiveUnit.tsx`) displays elapsed time vs estimated, with visual over-time indicator and progress bar.

### 8.2-10: 26 pre-configured steps defined per spec table
- **Status**: NOT IMPLEMENTED
- **Evidence**: Seed data creates 6 generic stations (Winding, Magnet Install, Housing Assembly, Quality Inspection, Electrical Test, Final Test) with 6 routing operations. None of the 26 spec-defined steps exist.
- **Gap**: Need seed data or migration to create all 26 spec-defined process steps.

---

## 8.3 Operator Interface Requirements

### 8.3-01: Accessible on mobile, tablet, and desktop
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: The operator UI uses responsive Tailwind CSS classes (`sm:`, `lg:` breakpoints) in `StationPage` and components. Large touch targets (h-24 for pass/fail buttons, h-16 for action buttons, min-h-[44px] for BOM select buttons). However, no explicit mobile viewport meta optimization or PWA manifest was found.
- **Gap**: No PWA support, no offline capability, no explicit mobile-first responsive testing evidence.

### 8.3-02: Display only current step information to operator
- **Status**: IMPLEMENTED
- **Evidence**: `ActiveUnit.tsx` shows only the current active execution's operation info (step number, elapsed time, estimated time). Previous station history is available via `PreviousStationsHistory` component but presented as supplementary context, not cluttering the main view.

### 8.3-03: Barcode / QR code scanning support
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `CreateUnitDialog.tsx` has a text input for serial number with placeholder "Scan a barcode or enter manually". `MaterialConsumptionDialog.tsx` has "Search or Scan Lot Number" input. These accept keyboard wedge barcode scanner input (text input that receives scanned data). However, there is no native camera-based barcode/QR scanning integration.
- **Gap**: Relies on external barcode scanner hardware via keyboard wedge. No in-browser camera-based scanning.

### 8.3-04: Camera-based scanning capability
- **Status**: NOT IMPLEMENTED
- **Evidence**: No camera API integration, no `getUserMedia()` calls, no barcode scanning library (e.g., QuaggaJS, zxing-js). All scanning relies on keyboard wedge input.
- **Gap**: Need browser-based camera scanning library integration.

### 8.3-05: Auto-populate data from prior steps or equipment
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `PreviousStationsHistory` component shows previous station results/cycle times. BOM items auto-populate quantity from `qtyPerUnit` when a BOM material is selected in `MaterialConsumptionDialog`. However, no data from prior steps auto-fills current step fields, and no equipment integration auto-populates data.
- **Gap**: No equipment data auto-population. Prior step data is display-only, not auto-filled into current step fields.

### 8.3-06: Clear pass/fail visual feedback
- **Status**: IMPLEMENTED
- **Evidence**: `ActiveUnit.tsx` has large pass (green, h-24) and fail (red, h-24) buttons with distinct icons. `QualityCheckDialog.tsx` has explicit PASS/FAIL buttons with color coding. Error messages displayed in red alert boxes.

### 8.3-07: Free-text notes capability
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `completeOperation()` accepts optional `notes` parameter and stores in `UnitOperationExecution.notes`. However, the operator UI (`ActiveUnit.tsx`) does not expose a notes input field -- the `handleComplete` function calls `completeOperation(executionId, result)` without passing notes. Notes are only available on downtime intervals.
- **Gap**: Need a notes text area on the operator station UI for operation completion.

### 8.3-08: Simple PIN or badge login
- **Status**: NOT IMPLEMENTED
- **Evidence**: Authentication uses Clerk (`requireUser()` from `@/lib/auth/rbac`), which is a full OAuth/email-based auth system. No PIN-based login or badge tap authentication for shop floor operators.
- **Gap**: Need simplified PIN/badge authentication flow for operators on the shop floor.

---

## 8.4 Automated Data Ingestion from Equipment

### 8.4-01: USB device data ingestion
- **Status**: NOT IMPLEMENTED
- **Evidence**: No USB device communication code anywhere in the codebase.
- **Gap**: Need USB device integration layer (likely via Web USB API or local agent).

### 8.4-02: Serial port data ingestion
- **Status**: NOT IMPLEMENTED
- **Evidence**: No serial port communication code. No Web Serial API usage.
- **Gap**: Need serial port integration (Web Serial API or local agent).

### 8.4-03: Ethernet / network device data ingestion
- **Status**: NOT IMPLEMENTED
- **Evidence**: No network device communication protocol handlers (OPC-UA, Modbus TCP, etc.).
- **Gap**: Need network device protocol integration.

### 8.4-04: File-drop ingestion (CSV/JSON)
- **Status**: NOT IMPLEMENTED
- **Evidence**: No file upload endpoint for equipment data files. No CSV/JSON parsing for equipment readings.
- **Gap**: Need file upload endpoint and parser for equipment data files.

### 8.4-05: Admin-configurable field mapping for equipment data
- **Status**: NOT IMPLEMENTED
- **Evidence**: No field mapping configuration UI or data model.
- **Gap**: Need equipment data field mapping configuration.

### 8.4-06: Flag out-of-spec values from equipment data
- **Status**: NOT IMPLEMENTED
- **Evidence**: No automated spec-limit checking on ingested data. Quality checks have min/max limits but these are for manual operator entry, not automated equipment data.
- **Gap**: Need automated out-of-spec flagging for ingested equipment values.

### 8.4-07: Store raw equipment data files
- **Status**: NOT IMPLEMENTED
- **Evidence**: No file storage mechanism for raw equipment data. No blob storage or file system storage configuration.
- **Gap**: Need raw file storage (S3/blob storage or file system).

### 8.4-08: Equipment data ingestion extensible without core code changes
- **Status**: NOT IMPLEMENTED
- **Evidence**: No plugin architecture or configuration-driven equipment adapter system.
- **Gap**: Need extensible adapter/plugin architecture for equipment integration.

---

## 8.5 Cycle Time Tracking

### 8.5-01: Automatic cycle time tracking via open/submit timestamps
- **Status**: IMPLEMENTED
- **Evidence**: `startOperation()` records `startedAt = new Date()`. `completeOperation()` calculates `cycleTimeMinutes = (completedAt - startedAt) / 60000` and stores it on `UnitOperationExecution.cycleTimeMinutes`. Operator UI shows elapsed time in real-time.

### 8.5-02: Station scan cycle time (badge/barcode scan at start and end)
- **Status**: NOT IMPLEMENTED
- **Evidence**: Cycle time is tied to operation start/complete actions in the UI, not to physical badge or barcode scan events at the station.
- **Gap**: Need scan-based cycle time tracking as an alternative to UI button-based tracking.

### 8.5-03: Batch-level cycle time tracking (start/end/qty for a batch)
- **Status**: NOT IMPLEMENTED
- **Evidence**: All cycle time tracking is per-unit (UnitOperationExecution). No batch-level start/end/quantity cycle time model exists.
- **Gap**: Need batch cycle time tracking model and UI.

### 8.5-04: Exception-only cycle time tracking mode
- **Status**: NOT IMPLEMENTED
- **Evidence**: No concept of exception-only mode where cycle time is only recorded when it deviates from normal. All operations track cycle time.
- **Gap**: Need configurable exception-only cycle time mode.

### 8.5-05: Cycle time tracking method selectable per step by admin
- **Status**: NOT IMPLEMENTED
- **Evidence**: No admin configuration for selecting cycle time tracking method per step. All steps use the same automatic (open/submit) method.
- **Gap**: Need per-step cycle time method configuration in admin UI.

### 8.5-06: Cycle time statistics and analytics
- **Status**: IMPLEMENTED
- **Evidence**: `analytics.ts` provides `getCycleTimeByStation()` (avg/min/max per station), `getCycleTimeTrend()` (time-series data), and `getCycleTimeOutliers()` (statistical outlier detection using std deviation).

---

## 8.6 In-Process Failure and Rework

### 8.6-01: Create NCR event on operation failure
- **Status**: IMPLEMENTED
- **Evidence**: `quality.ts` `recordQualityCheck()` auto-creates NCR when quality check fails (lines 86-96). `completeOperation()` with result='fail' sets unit status to 'rework'. Event `ncr_created` emitted with full payload.

### 8.6-02: Flag unit as "Rework Required" on failure
- **Status**: IMPLEMENTED
- **Evidence**: `completeOperation()` sets `unitStatus = 'rework'` when `result === 'fail'` (units.ts line 269). Quality check failure also triggers `createNCR()` which sets unit status to 'rework' (quality.ts line 163-165). Unit status badge shown in operator UI.

### 8.6-03: Open rework record with failure mode and corrective action
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `NonconformanceRecord` model has `defectType` (failure mode) and `description`, and `disposition` (rework/scrap/use_as_is/defer). Event `rework_created` is emitted. However, there is no formal "corrective action" field -- only the NCR description and closure notes.
- **Gap**: Need explicit corrective action field on NCR or a separate rework record model with corrective action tracking.

### 8.6-04: Re-inspection required after rework completion
- **Status**: NOT IMPLEMENTED
- **Evidence**: `closeNCR()` simply sets unit status back to 'in_progress' and emits `rework_completed` event. No mandatory re-inspection step is enforced. The unit can proceed without passing any quality check after rework.
- **Gap**: Need mandatory re-inspection workflow after rework -- either auto-queue a quality check or require a re-inspection step before the unit can advance.

### 8.6-05: Scrap recording with inventory update
- **Status**: PARTIALLY IMPLEMENTED
- **Evidence**: `dispositionNCR()` with `disposition='scrap'` sets unit to 'scrapped', increments `workOrder.qtyScrap`, and emits `scrap_recorded` event. However, there is no reverse adjustment to consumed material inventory -- scrapped materials are not returned to inventory.
- **Gap**: No material inventory adjustment when a unit is scrapped. Consumed materials remain decremented even though the unit is scrapped.

### 8.6-06: First-pass yield (FPY) calculation
- **Status**: NOT IMPLEMENTED
- **Evidence**: No FPY calculation exists in any action or analytics file. The OEE page (`src/app/dashboard/oee/page.tsx`) calculates a general quality rate from quality check results but does not calculate true first-pass yield (units that pass all operations on first attempt without rework/NCR).
- **Gap**: Need FPY calculation: (units passing all operations on first attempt) / (total units started).

### 8.6-07: NCR disposition workflow (supervisor/admin only)
- **Status**: IMPLEMENTED
- **Evidence**: `dispositionNCR()` requires `requireRole(['supervisor', 'admin'])`. Supports dispositions: rework, scrap, use_as_is, defer. Status transitions: open -> dispositioned -> closed. Events emitted for each state change.

### 8.6-08: Rework completion and NCR closure workflow
- **Status**: IMPLEMENTED
- **Evidence**: `closeNCR()` requires supervisor/admin role, validates NCR is in 'dispositioned' status, sets status to 'closed', records closure timestamp and notes, updates unit status back to 'in_progress' for rework dispositions, emits `rework_completed` and `ncr_closed` events.

### 8.6-09: NCR creates event in event log
- **Status**: IMPLEMENTED
- **Evidence**: Full event trail: `ncr_created`, `ncr_dispositioned`, `scrap_recorded`, `rework_created`, `rework_completed`, `ncr_closed` -- all emitted with idempotency keys and full payloads.

---

## Cross-Cutting Concerns

### 8.X-01: All production data capture actions emit events
- **Status**: IMPLEMENTED
- **Evidence**: `operation_started`, `operation_completed`, `operation_failed`, `quality_check_recorded`, `material_lot_consumed`, `ncr_created`, `ncr_dispositioned`, `scrap_recorded`, `rework_created`, `rework_completed` -- all emitted with idempotency keys.

### 8.X-02: RBAC enforcement on production data actions
- **Status**: IMPLEMENTED
- **Evidence**: All server actions call `requireUser()` or `requireRole()`. NCR disposition/closure restricted to supervisor/admin. Operator actions require authenticated user.

### 8.X-03: Input validation on server actions
- **Status**: IMPLEMENTED
- **Evidence**: All server actions use Zod schema validation (e.g., `createUnitSchema.parse()`, `completeOperationSchema.parse()`, `recordQualityCheckSchema.parse()`).

---

## Priority Gap Summary

### Critical (Core spec requirements, no implementation):
1. **Configurable per-step data fields** (8.2-06) -- No mechanism for admin-defined data fields with types, units, and limits per step. This is fundamental to production data capture.
2. **26 pre-configured process steps** (8.2-10) -- Only 6 generic stations exist vs. 26 spec-defined steps.
3. **7 process categories** (8.1-02) -- No process category taxonomy.
4. **First-pass yield calculation** (8.6-06) -- No FPY metric despite being a spec requirement.
5. **Re-inspection after rework** (8.6-04) -- No enforcement of re-inspection workflow.

### High (Significant functionality gaps):
6. **Admin process step configuration UI** (8.2-01) -- No admin interface for step management.
7. **Step name/description** (8.2-02) -- Operations identified only by sequence number.
8. **Operator sign-off** (8.2-07) -- No sign-off mechanism.
9. **Camera-based scanning** (8.3-04) -- No browser-based camera scanning.
10. **PIN/badge login** (8.3-08) -- Full Clerk auth only, no shop-floor-friendly login.
11. **Notes field in operator UI** (8.3-07) -- Backend supports notes but UI doesn't expose it.

### Medium (Equipment integration -- future phase likely):
12. **All equipment data ingestion** (8.4-01 through 8.4-08) -- Entire subsection not implemented. This is often a Phase 2+ capability.
13. **Batch-level cycle time** (8.5-03) -- No batch tracking model.
14. **Cycle time method selection per step** (8.5-05) -- Single method only.
15. **Corrective action tracking on rework** (8.6-03) -- Only informal notes, no structured corrective action.

### Low (Enhancement-level):
16. **Mandatory/optional step flag** (8.2-05) -- All steps implicitly mandatory.
17. **Station scan cycle time** (8.5-02) -- Alternative tracking method.
18. **Exception-only cycle time** (8.5-04) -- Niche tracking mode.
19. **Scrap material inventory reversal** (8.6-05) -- Consumed materials not returned on scrap.
