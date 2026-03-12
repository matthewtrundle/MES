# Section 16: Future Capabilities

## Source: Spec section 16 (post-launch capabilities table)

## Architectural Readiness Assessment

These are post-launch features that must be "architecturally supported" -- meaning the current design should not preclude them, even if no implementation exists yet.

| ID | Future Capability | Arch Ready? | Evidence | Risk |
|----|------------------|-------------|----------|------|
| 16-01 | Production planning/scheduling | YES | `WorkOrder` model has `priority`, `dueDate`, `status` state machine. `Routing` defines operation sequences with `estimatedMinutes`. `Shift` model exists. Event-driven architecture allows adding a scheduling service that reads current state from events and writes plan data. No scheduling engine or Gantt UI, but data model supports it. | LOW |
| 16-02 | Onshape BOM sync | YES | `BillOfMaterial` model stores per-routing, per-station material requirements with `materialCode`, `qtyPerUnit`, `unitOfMeasure`. `Routing` has `productCode`. An Onshape API adapter could populate these models without schema changes. No import mechanism exists yet. | LOW |
| 16-03 | Advanced SPC (Xbar-R, Cp/Cpk) | PARTIAL | `QualityCheckResult` stores measurement values in `valuesJson` JSON field. `QualityCheckDefinition` has `checkType` (pass_fail, measurement, checklist) with `parameters` JSON (min/max/target). However, no multi-sample recording per check, no subgroup concept, no statistical calculation engine, and no control chart visualization. The measurement data is captured but not in the structured format SPC requires (subgroups of n samples). | MEDIUM |
| 16-04 | Customer portal | YES | `User` model with `Role` enum could be extended with a `customer` role. Clerk auth supports multiple user types. `WorkOrder` tracks status and completion. Read-only views could be built on existing Server Components. No customer-specific models or access patterns exist, but the RBAC framework is extensible. | LOW |
| 16-05 | Preventive maintenance | PARTIAL | `Station` model exists with `active` flag and `config` JSON. `DowntimeInterval` tracks station downtime with reasons. However, no maintenance schedule model, no asset register, no PM work order type, no maintenance task templates. `DowntimeReason` has `isPlanned` flag which could distinguish PM downtime. | MEDIUM |
| 16-06 | AOI (Automated Optical Inspection) integration | YES | `QualityCheckDefinition` supports flexible check types. `QualityCheckResult.valuesJson` can store AOI output (pass/fail, defect images, coordinates). The MQTT/HTTP ingestion architecture (once implemented per 14.2-05) would allow AOI machines to publish results. No AOI-specific models needed beyond quality check framework. | LOW |
| 16-07 | Multi-site support | YES | `Site` model is a first-class entity. All major models (`Station`, `WorkOrder`, `Event`, `DowntimeReason`, `Shift`, `AIInsight`) are site-scoped via `siteId` foreign key. `User` has many-to-many `sites` relation. Event queries filter by `siteId`. Architecture is multi-site ready at the data model level. | LOW |
| 16-08 | Operator training records | PARTIAL | `User` model tracks operators with `role`, `assignedStationId`, and site associations. `Event` table captures `user_login` events. However, no training module, no certification model, no skill matrix, no training-to-station qualification linkage. Adding a `Certification` model with `userId`, `stationId`, `expiresAt` fields would be a small schema addition. | MEDIUM |
| 16-09 | CO2/materials sustainability reporting | PARTIAL | `UnitMaterialConsumption` tracks every material consumed per unit with quantities. `MaterialLot` has supplier info. `Event` table provides full production history. However, no CO2 factor table, no energy tracking, no sustainability metrics calculation, no reporting framework. The consumption data needed for basic materials reporting is captured. | MEDIUM |
| 16-10 | Defense compliance (ITAR/CMMC) | PARTIAL | `AuditLog` records all config changes with before/after JSON. `Event` table is immutable and comprehensive. `User` auth via Clerk with RBAC. However, no data classification model, no export control flags, no access logging beyond audit trail, no document control system, no CMMC-specific controls (MFA enforcement, session timeout, data loss prevention). | HIGH |
| 16-11 | JIT (Just-In-Time) manufacturing | YES | `Kit` and `KitLine` models support material staging to work orders. `MaterialLot` with FIFO consumption and `BillOfMaterial` define material requirements. `WorkOrder.dueDate` and `priority` enable scheduling alignment. The kitting and inventory system provides the material control foundation JIT requires. | LOW |
| 16-12 | Robust cybersecurity | PARTIAL | Clerk handles authentication. RBAC enforced at Server Action and API levels. Non-root Docker user. However, no TLS configuration, no encryption at rest, no rate limiting, no CORS policy, no CSP headers, no dependency scanning, no penetration testing, no security audit trail beyond `AuditLog`. See Section 15.3 gaps. | HIGH |
| 16-13 | Predictive maintenance | PARTIAL | `DowntimeInterval` with timestamps and reasons provides historical downtime data. `Event` stream captures production metrics. `AIInsight` model exists for anomaly detection and predictions. AI analysis routes (`/api/ai/insights`, `/api/ai/analyze`) provide ML integration points. However, no time-series database, no sensor data model, no ML pipeline, no failure prediction algorithms. | MEDIUM |

## Coverage Summary

- **Total Future Capabilities**: 13
- **Architecturally Ready (YES)**: 5 (38%)
- **Partially Ready (PARTIAL)**: 6 (46%)
- **Not Ready (NO)**: 0 (0%)
- **High Risk items**: 2 (Defense compliance, Cybersecurity)

## Architecture Notes

The codebase is well-positioned for most future capabilities. The event-driven design, multi-site data model, flexible JSON fields, and RBAC framework provide extensible foundations. The highest-risk items (defense compliance and cybersecurity) require infrastructure and operational controls that go beyond application code. Advanced SPC is a medium-risk gap because the current single-measurement-per-check data model does not naturally support the subgroup-based sampling that Xbar-R and Cp/Cpk calculations require.

Key structural enablers:
- `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` - multi-site scoping, JSON config fields, BOM/routing/kitting models
- `/Users/matthewrundle/Documents/MES-local/src/lib/db/events.ts` - immutable event stream for replay and analytics
- `/Users/matthewrundle/Documents/MES-local/src/lib/db/audit.ts` - audit trail for compliance
- `/Users/matthewrundle/Documents/MES-local/src/lib/auth/rbac.ts` - extensible role system
- `/Users/matthewrundle/Documents/MES-local/src/app/api/ai/` - AI integration points for predictive capabilities
