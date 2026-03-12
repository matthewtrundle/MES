# Section 17: Integration Tests

## Source: Spec section 17 (lines 1056-1068)

## Spec-Defined Integration Tests vs. Codebase Coverage

The spec defines 6 end-to-end integration tests. The codebase has 7 test files in `tests/`. Below maps each spec test to existing coverage.

| ID | Spec Integration Test | Status | Evidence | Gap Size |
|----|----------------------|--------|----------|----------|
| 17-01 | Lot-controlled receiving -> QA hold -> release -> directed putaway -> pick | PARTIAL | `tests/integration/material-lifecycle.test.ts` covers lot expiry checking, FIFO ordering, quantity validation, and lot status transitions (available -> depleted). `tests/integration/inventory-accuracy.test.ts` covers on-hand/committed/available calculations and kit line reservations. However, no test covers the full end-to-end flow: receiving a lot, placing on QA hold (quarantine), releasing from hold, directed putaway to a storage location, and picking for production. There is no storage location model and no putaway/pick workflow in the codebase. Tests are pure-function unit tests, not database integration tests. | L |
| 17-02 | Kit build -> verification -> line-side staging -> issue to WIP by scan | PARTIAL | `tests/unit/kitting.test.ts` tests kitting logic. `Kit` and `KitLine` models exist in schema with statuses `pending -> in_progress -> complete -> issued`. `src/lib/actions/kitting.ts` implements kit creation and line picking. However, no test covers the full flow: building a kit from BOM, verifying completeness, staging at line-side, and issuing to WIP via barcode scan. No barcode/scan simulation in tests. No line-side staging location model. | M |
| 17-03 | Serial creation -> full genealogy through each process step -> MQTT input | PARTIAL | `tests/integration/events.integration.ts` tests event emission and idempotency with a real database. The simulation tick route (`/api/simulation/tick/route.ts`) demonstrates the full unit lifecycle: unit creation with serial, operation execution at each station, material consumption at each station, and quality recording on completion. However, this is a simulation endpoint, not a test. No test validates full serial genealogy (material lots consumed at each station, operator at each step, timestamps). No MQTT input path exists (deferred per DEC-005). | L |
| 17-04 | Recipe download -> as-run parameter capture -> test capture -> auto-hold on fail | NOT_IMPLEMENTED | No recipe/work instruction model in schema. `Routing.operations` is a JSON array of station sequences, not a recipe with parameters. No as-run parameter capture (actual vs. target values per process step). `QualityCheckResult` captures test results, and NCR creation exists for failures, but no automatic hold-on-fail trigger that blocks unit progression. No test for this flow. | L |
| 17-05 | Rework loop (replace bearing/rebalance) with updated genealogy and re-test | PARTIAL | `tests/integration/quality-ncr-flow.test.ts` covers NCR lifecycle: creation, disposition (rework/scrap/use_as_is/defer), and closure. NCR disposition route emits `rework_created` event. `Unit.status` can transition to `rework`. However, no test covers the full rework loop: NCR disposition -> rework work instruction -> component replacement with updated material genealogy -> re-execution of process steps -> re-test -> return to main flow. The rework path is a status flag, not a full re-routing mechanism. | L |
| 17-06 | Financial reconciliation (order demand -> PO receipts -> consumption -> completion -> variance) | NOT_IMPLEMENTED | `MaterialLot` tracks `purchaseOrderNumber` (text field). `UnitMaterialConsumption` tracks quantities consumed. `WorkOrder` tracks `qtyOrdered`, `qtyCompleted`, `qtyScrap`. However, no cost model, no PO cost data, no standard vs. actual cost comparison, no variance calculation, no financial reporting. `tests/integration/inventory-accuracy.test.ts` tests quantity accuracy but not financial reconciliation. | L |

## Existing Test Inventory

| Test File | Type | What It Tests | Spec Coverage |
|-----------|------|---------------|---------------|
| `tests/integration/events.integration.ts` | Integration (DB) | Event emission, idempotency key dedup | Partial 17-03 |
| `tests/integration/rbac.test.ts` | Unit (mocked) | RBAC HttpError, forbidden/unauthorized helpers, role types | Cross-cutting (not spec-mapped) |
| `tests/integration/material-lifecycle.test.ts` | Unit (pure) | Lot expiry, FIFO, qty validation, lot status transitions | Partial 17-01 |
| `tests/integration/work-order-lifecycle.test.ts` | Unit (pure) | WO state machine, release/complete/cancel rules, qty validation | Cross-cutting |
| `tests/integration/inventory-accuracy.test.ts` | Unit (pure) | On-hand calc, committed qty, available, low stock, expiring lots | Partial 17-01 |
| `tests/integration/quality-ncr-flow.test.ts` | Unit (pure) | Quality check validation, NCR lifecycle, disposition transitions | Partial 17-05 |
| `tests/unit/validation.test.ts` | Unit | Input validation | Cross-cutting |
| `tests/unit/bom.test.ts` | Unit | BOM logic | Partial 17-02 |
| `tests/unit/kitting.test.ts` | Unit | Kitting logic | Partial 17-02 |

## Coverage Summary

- **Total Spec-Defined Tests**: 6
- **IMPLEMENTED**: 0 (0%)
- **PARTIAL**: 4 (67%)
- **NOT_IMPLEMENTED**: 2 (33%)

## Key Observations

1. **No true end-to-end integration tests**: The existing "integration" tests in `tests/integration/` are mostly pure-function unit tests that test business logic in isolation (no database, no API calls). Only `events.integration.ts` hits the real database. None of the tests exercise the full application stack (HTTP request -> Server Action -> database -> event emission -> state update).

2. **Simulation as proxy**: The simulation tick endpoint (`/api/simulation/tick/route.ts`) exercises much of the production flow (unit creation, station progression, material consumption, completion) but is a demo tool, not an automated test.

3. **Missing domain concepts block full test coverage**: Several spec tests require domain models that do not exist yet:
   - **17-01**: No storage location / putaway model
   - **17-04**: No recipe / work instruction / as-run parameter model
   - **17-05**: No rework re-routing mechanism (rework is a status, not a workflow)
   - **17-06**: No cost / financial model

4. **Test infrastructure exists**: `tests/helpers/db.ts` provides test database utilities (`getOrCreateTestSite`, `createTestStation`, `cleanupTestData`). `tests/setup.ts` configures the test environment. Vitest is configured and working. The foundation for adding proper integration tests is in place.

Key files:
- `/Users/matthewrundle/Documents/MES-local/tests/` - all test files
- `/Users/matthewrundle/Documents/MES-local/tests/helpers/db.ts` - test database helpers
- `/Users/matthewrundle/Documents/MES-local/src/app/api/simulation/tick/route.ts` - simulation that exercises production flow
- `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` - data model (shows missing domain concepts)
