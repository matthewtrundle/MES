# Implementation Phase Map

**Generated**: 2026-03-12
**Based on**: Gap analysis of 17 spec sections (~295 requirements)
**Scoring**: Business Value (1-5) × Feasibility (1-5) = Priority Score

---

## Phase Overview

| Phase | Name | Priority Score | Est. Effort | Key Deliverables |
|-------|------|---------------|-------------|-----------------|
| **P0** | Foundation & Data Model | 20-25 (Critical) | 2-3 weeks | Part Master, BOM revision, configurable data fields |
| **P1** | Core Workflow Completion | 15-20 (High) | 3-4 weeks | EOL gate, serialization fix, WO enhancements, inventory ledger |
| **P2** | Upstream Modules | 10-15 (High) | 4-6 weeks | Procurement/PO, receiving workflow, IQC |
| **P3** | Downstream & Integration | 10-15 (High) | 3-4 weeks | Shipping, REST API, notifications, webhooks |
| **P4** | Analytics & Polish | 5-10 (Medium) | 2-3 weeks | SPC, FPY trending, data export, report builder |
| **P5** | Infrastructure & Compliance | 5-10 (Medium) | 2-3 weeks | TLS, backups, dark mode, offline mode, role expansion |
| **P6** | Hardware Integration | 1-5 (Low) | 4-8 weeks | Label printers, equipment ingestion, MQTT, carrier APIs |

---

## P0: Foundation & Data Model (Critical — Unblocks Everything)

**Why first**: Part Master and configurable data fields are prerequisites for Procurement, IQC, BOM change management, and half the remaining gaps. Building these first prevents rework.

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P0.1 | **Part Master entity** — Prisma model with part number (510-XXXXX), revision, category, UoM, preferred suppliers, reorder point, target stock, standard cost, serialization requirement, hazmat flag, active/obsolete | XL | 05 | None |
| P0.2 | **Supplier Master entity** — name, ID, contact info, country of origin, preferred parts, qualification status, quality/delivery metrics (calculated) | L | 02, 05 | None |
| P0.3 | **BOM revision control** — version field on BOM, historical revisions preserved, copy-on-new-revision, effective date | L | 05 | P0.1 |
| P0.4 | **Multi-level BOM** — parent/child subassembly hierarchy (Stator, Rotor, Wire Harness, Base, Final Assembly) | L | 05 | P0.3 |
| P0.5 | **Configurable per-step data fields** — JSON field schema on WorkOrderOperation or new ProcessStepDefinition model, admin UI for field config, operator UI for data entry | XL | 08 | None |
| P0.6 | **CTQ Dimension model** — per part/revision, nominal/USL/LSL, measurement tool, sample size, safety-critical flag, revision-controlled | L | 04 | P0.1 |
| P0.7 | **Migrate materialCode references** — replace free-text materialCode strings with Part Master FK across BOM, MaterialLot, KitLine | M | 05, 06 | P0.1 |

**Schema changes**: Yes — 3-4 new models, 5+ field additions, FK migrations
**Estimated effort**: 2-3 weeks

---

## P1: Core Workflow Completion (Fix What's Built)

**Why second**: These enhance existing functionality that's partially built. No new modules — just completing the production execution loop.

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P1.1 | **EOL test suite** — dedicated EOL quality check type, composite pass/fail across all parameters, mandatory gate before serial/shipping | L | 10 | None |
| P1.2 | **Serial number gate inversion** — move serial assignment from unit creation to EOL pass, configurable serial format | M | 09, 10 | P1.1 |
| P1.3 | **Inventory transaction ledger** — immutable InventoryTransaction model (Receive, Issue, Return, Scrap, Adjustment, Transfer), unified audit trail | L | 06 | None |
| P1.4 | **Buildable units calculation** — per motor model, from available unreserved inventory vs BOM, identify limiting component, dashboard display | M | 06 | None |
| P1.5 | **FIFO auto-reservation at WO creation** — reserve inventory per BOM on work order release, alert shortages | M | 07 | None |
| P1.6 | **WO status expansion** — add Draft, Kitting, In Testing, Shipped statuses, timestamp each transition | S | 07 | None |
| P1.7 | **WO customer fields** — customer name, customer order ref, target start date, notes | S | 07 | None |
| P1.8 | **Production traveler** — printable/digital document with WO details, BOM, process steps, sign-off fields | M | 07 | P0.5 |
| P1.9 | **Pre-configure 26 process steps** — seed the 26 spec-defined process steps with data fields | M | 08 | P0.5 |
| P1.10 | **First-pass yield calculation** — FPY per step and per station, distinguish first-pass from rework-pass | S | 08, 12 | None |

**Schema changes**: 1-2 new models, 5+ field additions
**Estimated effort**: 3-4 weeks

---

## P2: Upstream Modules (Procurement → Receiving → IQC)

**Why third**: These are greenfield modules that depend on P0 foundations (Part Master, Supplier Master, CTQ). Build in order: PO → Receiving → IQC (upstream to downstream).

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P2.1 | **PurchaseOrder + LineItem models** — full data model per spec 2.2, status lifecycle, cost fields | L | 02 | P0.1, P0.2 |
| P2.2 | **PO creation UI** — web form with part master search, supplier auto-populate, multi-line, drawing upload | XL | 02 | P2.1 |
| P2.3 | **PO REST API endpoint** — JSON ingestion for external systems | M | 02, 14 | P2.1 |
| P2.4 | **CSV/Excel PO import** — file upload with configurable field mapping | L | 02 | P2.1 |
| P2.5 | **PO-driven receiving workflow** — search POs, confirm/adjust quantities, record carrier/tracking/notes | L | 03 | P2.1 |
| P2.6 | **Pending inspection status + IQC trigger** — receiving transitions lots to "pending_iqc", auto-create inspection record | M | 03, 04 | P2.5, P0.6 |
| P2.7 | **IQC inspection execution UI** — inspector queue, step-through CTQs, multi-sample, pass/fail evaluation | XL | 04 | P0.6, P2.6 |
| P2.8 | **IQC disposition workflow** — conforming/rework/UAI/scrap, release to inventory or hold | L | 04 | P2.7 |
| P2.9 | **IQC-specific NCR enhancements** — NCR number, link to PO/lot, structured fields, corrective action, supplier notification | M | 04 | P2.7 |
| P2.10 | **Discrepancy handling** — short/over shipment detection and workflow | M | 03 | P2.5 |
| P2.11 | **Lead time tracking** — actual lead time per supplier-part from PO history | S | 02 | P2.1 |

**Schema changes**: 3-4 new models (PurchaseOrder, PurchaseOrderLineItem, IncomingInspection, IQCResult)
**Estimated effort**: 4-6 weeks

---

## P3: Downstream & Integration (Shipping + API + Notifications)

**Why fourth**: Completes the value chain (production → shipping) and enables external system integration.

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P3.1 | **Shipping data model** — Shipment, ShipmentLine models, Customer model or WO customer fields | L | 11 | P1.7 |
| P3.2 | **Packing list generation** — auto-generate from WO with serial numbers, customer info, quantities | M | 11 | P3.1 |
| P3.3 | **Certificate of Conformance PDF** — generate CoC with motor serials, EOL pass confirmation, spec compliance | M | 11, 09 | P3.1, P1.1 |
| P3.4 | **Shipping record + status transition** — immutable shipping record, transition WO/units to Shipped | M | 11 | P3.1 |
| P3.5 | **REST API layer** — documented API for all core entities, OpenAPI spec | L | 14 | None |
| P3.6 | **Token-based API auth** — API keys or bearer tokens for M2M integration | M | 14 | P3.5 |
| P3.7 | **Notification system** — in-app alerts + email delivery, configurable triggers | L | 13 | None |
| P3.8 | **Outbound webhooks** — webhook registration, event-driven HTTP callbacks, retry logic | M | 14 | None |
| P3.9 | **Data export** — CSV/Excel/PDF export from dashboards and reports | M | 12, 13 | None |

**Schema changes**: 2-3 new models (Shipment, ShipmentLine, WebhookSubscription, Notification)
**Estimated effort**: 3-4 weeks

---

## P4: Analytics & Polish

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P4.1 | **SPC / Cp/Cpk** — statistical process control calculation, control charts, drift detection | L | 12 | P0.5 (structured measurement data) |
| P4.2 | **FPY trending** — first-pass yield by step over time, trend charts | M | 12 | P1.10 |
| P4.3 | **NCR aging + severity** — days-open calculation, severity field, aging buckets | S | 12 | None |
| P4.4 | **Supplier quality scorecard** — acceptance rate, on-time delivery, NCR rate per supplier | M | 12 | P0.2, P2.1 |
| P4.5 | **Operator productivity** — units processed and FPY by operator over time | M | 12 | None |
| P4.6 | **Production history browser** — bulk query by date range, model, WO | M | 12 | None |
| P4.7 | **Inventory reports** — stock vs reorder, inventory turns, cost valuation | M | 12 | P0.1 (cost fields) |
| P4.8 | **Custom report builder** — drag-and-drop field selection, filters, scheduled email delivery | XL | 12 | P3.7 (email) |

**Estimated effort**: 2-3 weeks (excluding report builder)

---

## P5: Infrastructure & Compliance

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P5.1 | **Role expansion (3→8)** — Buyer, Receiving Mgr, QA Inspector, Supply Chain Mgr, Shipping Coordinator | M | 01, 13 | P2, P3 modules exist |
| P5.2 | **User management admin UI** — create/edit/deactivate users, role assignment, station assignment | M | 13 | None |
| P5.3 | **Audit log viewer** — admin UI to browse audit trail, filter by entity/user/date | M | 13 | None |
| P5.4 | **Dark mode** — enable ThemeProvider, add toggle, test all components | S | 15 | None |
| P5.5 | **TLS + encryption at rest** — reverse proxy config, managed DB encryption | M | 15 | Infrastructure |
| P5.6 | **Database backups + PITR** — automated daily backups, WAL archiving, 30-day retention | M | 15 | Infrastructure |
| P5.7 | **Performance testing** — load test 20 concurrent users, 5-year data query benchmarks | M | 15 | None |
| P5.8 | **Offline mode (PWA)** — service worker, offline data cache, sync on reconnect | L | 15 | None |
| P5.9 | **API documentation** — OpenAPI spec, integration guide, ERD diagram | M | 14, 15 | P3.5 |
| P5.10 | **Security hardening** — rate limiting, CSP headers, dependency scanning, security patch SLA | M | 15, 16 | None |

**Estimated effort**: 2-3 weeks

---

## P6: Hardware Integration (Deferred)

| # | Item | Size | Sections | Dependencies |
|---|------|------|----------|-------------|
| P6.1 | **Label printer integration** — ZPL generation, network print, configurable templates | L | 03, 14 | P0.1 (label content) |
| P6.2 | **Equipment data ingestion framework** — USB/serial/Ethernet/file-drop adapter, configurable field mapping | XXL | 08, 14 | P0.5 |
| P6.3 | **MQTT ingestion** — MQTT client, message routing, station mapping | L | 14 | P6.2 |
| P6.4 | **Laser engraver integration** — serial transmission, engraving confirmation | M | 09, 14 | P1.2 |
| P6.5 | **Carrier API integration** — UPS/FedEx/USPS label generation, tracking | L | 11, 14 | P3.1 |
| P6.6 | **Barcode/QR scanning** — camera-based scanning, scanner device support | M | 08, 09 | None |
| P6.7 | **Grafana integration** — data source provisioning, dashboard templates | M | 14 | P3.5 |

**Estimated effort**: 4-8 weeks

---

## Total Estimated Effort

| Phase | Weeks | Cumulative |
|-------|-------|------------|
| P0 Foundation | 2-3 | 2-3 |
| P1 Core Completion | 3-4 | 5-7 |
| P2 Upstream Modules | 4-6 | 9-13 |
| P3 Downstream + Integration | 3-4 | 12-17 |
| P4 Analytics | 2-3 | 14-20 |
| P5 Infrastructure | 2-3 | 16-23 |
| P6 Hardware | 4-8 | 20-31 |

**Full spec coverage estimate: ~20-31 weeks** (depending on parallelism and team size)

---

## Recommended Approach: Swarm Dev with Claude Code

For maximum velocity, each phase can be parallelized across Claude Code agents:

**P0 (Foundation)**: 3-4 parallel agents in worktrees
- Agent 1: Part Master + Supplier Master models + migration
- Agent 2: BOM revision control + multi-level hierarchy
- Agent 3: Configurable data fields + CTQ model
- Agent 4: materialCode FK migration

**P1 (Core Completion)**: 4-5 parallel agents
- Agent 1: EOL test suite + serial number gate
- Agent 2: Inventory transaction ledger + buildable units
- Agent 3: WO enhancements (status, fields, FIFO reservation)
- Agent 4: Production traveler + 26 process steps
- Agent 5: FPY calculation

**P2-P6**: Similar parallel decomposition per phase

This approach could compress the timeline to **12-18 weeks** with aggressive parallelism.
