# Section 12: Analytics, Dashboards, and Reporting -- Gap Analysis

## 12.1 Executive Dashboard

### Spec Requirements
- Units produced today/week/month vs target
- Active WOs + status
- Overall FPY (first pass yield)
- Open NCRs by age/severity
- Inventory health
- On-time delivery rate

### Current State
- **Units produced today vs target**: IMPLEMENTED. Main dashboard (`src/app/dashboard/page.tsx`) shows `unitsCompletedToday` vs `expectedUnitsByNow` (shift-based target), with KPICard color-coding for above/below target.
- **Active WOs + status**: PARTIAL. Dashboard shows active WO count and a hero section for the current work order with progress bar (qtyCompleted/qtyOrdered). Production page (`src/app/dashboard/production/page.tsx`) shows WO progress. No week/month aggregation.
- **Overall FPY**: PARTIAL. Quality rate calculated as pass/(pass+fail) from today's quality check results. Displayed as "Quality Rate" KPI. No historical FPY trending by week/month.
- **Open NCRs**: PARTIAL. Count of open NCRs shown as KPI. NCR page (`src/app/dashboard/ncr/page.tsx`) lists open/dispositioned NCRs. No breakdown by age or severity -- NCR model has no severity field.
- **Inventory health**: IMPLEMENTED. Material runway calculation (lowest runway hours, critical/low material counts). KPICard shows material runway status.
- **On-time delivery rate**: NOT IMPLEMENTED. WorkOrder model has `dueDate` field but no delivery rate calculation exists.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Week/month production aggregation vs targets | Medium | Low |
| FPY trending over time (week/month) | High | Medium |
| NCR aging (days open) and severity breakdown | High | Medium |
| On-time delivery rate calculation | Medium | Medium |
| NCR model lacks severity field | Medium | Low (schema change) |


## 12.2 Workstation Performance

### Spec Requirements
- Units processed today/week per station
- Avg cycle time vs target per station
- FPY at station
- Open rework at station
- Downtime events per station

### Current State
- **Units processed**: IMPLEMENTED. Station detail page (`src/app/dashboard/station/[id]/page.tsx`) shows `completedToday` count. Shift report shows station productivity (completed ops). No weekly view.
- **Avg cycle time vs target**: IMPLEMENTED. Station detail page calculates `avgCycleTime` from recent operations and compares to `estimatedMinutes` (target). Color-coded when over target. Analytics action (`src/lib/actions/analytics.ts`) provides `getCycleTimeByStation()` with min/max/avg.
- **FPY at station**: PARTIAL. Station detail shows `passRate` from recent operations. No true FPY (first-pass vs rework-pass) distinction.
- **Open rework at station**: NOT IMPLEMENTED. Station page shows WIP units but does not filter/display rework units separately.
- **Downtime events per station**: IMPLEMENTED. Station detail page shows `totalDowntimeMinutes` today and downtime history. Pareto analytics page (`src/app/dashboard/analytics/page.tsx`) shows downtime by station.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Weekly station performance view | Medium | Low |
| True FPY (first pass vs rework pass) at station | High | Medium |
| Open rework units filtered view per station | Medium | Low |


## 12.3 Quality Analytics

### Spec Requirements
- FPY by step over time (trend chart)
- SPC (Cp/Cpk) with drift detection
- Pareto chart of failure modes
- NCR aging
- Supplier quality scorecard
- EOL failure rate by model/parameter

### Current State
- **FPY by step over time**: NOT IMPLEMENTED. Quality page (`src/app/dashboard/quality/page.tsx`) shows today's quality results by check type with pass rates, but no time-series trend chart.
- **SPC (Cp/Cpk)**: NOT IMPLEMENTED. Quality check results store `valuesJson` with measurements, but no SPC calculation, control charts, or drift detection logic exists.
- **Pareto chart of failure modes**: IMPLEMENTED. Analytics page (`src/app/dashboard/analytics/page.tsx`) includes Pareto charts for NCRs by defect type, quality failures by check type, and NCRs by station. Uses `ParetoChart` component (`src/components/supervisor/ParetoChart.tsx`).
- **NCR aging**: NOT IMPLEMENTED. NCR page shows open NCRs but no aging calculation (days since creation).
- **Supplier quality scorecard**: NOT IMPLEMENTED. MaterialLot has `supplier` field but no quality tracking tied to supplier.
- **EOL failure rate by model/parameter**: NOT IMPLEMENTED. No end-of-line specific analysis exists. Quality checks are generic, not differentiated as EOL tests.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| FPY trend chart (by step over time) | High | Medium |
| SPC with Cp/Cpk calculation and control charts | High | High |
| SPC drift detection and alerting | High | High |
| NCR aging analysis (days open, aging buckets) | Medium | Low |
| Supplier quality scorecard | Medium | Medium |
| EOL failure rate breakdown by model and parameter | Medium | Medium |


## 12.4 Inventory/Supply Chain Reports

### Spec Requirements
- Stock vs reorder points
- Open POs with ETA
- Actual vs quoted lead time
- Inventory turns
- Cost of inventory on hand

### Current State
- **Stock vs reorder points**: PARTIAL. Inventory dashboard (`src/app/dashboard/inventory/page.tsx`) shows on-hand, committed, and available quantities. Low stock alerts use consumption-rate-based projection (days remaining), not explicit reorder points. No reorder point field exists in schema.
- **Open POs with ETA**: NOT IMPLEMENTED. MaterialLot has `purchaseOrderNumber` field but no PurchaseOrder model exists. No ETA tracking.
- **Actual vs quoted lead time**: NOT IMPLEMENTED. No lead time data captured.
- **Inventory turns**: NOT IMPLEMENTED. No inventory turns calculation.
- **Cost of inventory on hand**: NOT IMPLEMENTED. No cost data in MaterialLot or any other model.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Reorder point field and stock-vs-reorder visualization | High | Medium |
| PurchaseOrder model with ETA tracking | High | High |
| Lead time tracking (actual vs quoted) | Medium | Medium |
| Inventory turns calculation | Medium | Low |
| Cost/price fields on materials and inventory valuation | Medium | Medium |


## 12.5 Production History

### Spec Requirements
- Full history by date/model/WO
- Lot genealogy (which motors contain lot)
- Reverse genealogy (motor -> components)
- Operator productivity
- Event stream
- Time series/high volume EOL data
- Blob storage for raw test files
- Golden keys (serial, operation ID, timestamp, resource ID, material lots)

### Current State
- **Full history by date/model/WO**: PARTIAL. Production page shows completed units today. Traceability search (`src/components/supervisor/TraceabilitySearch.tsx`) shows full unit history but requires manual serial lookup. No bulk history browsing by date range, model, or work order.
- **Lot genealogy (lot -> motors)**: IMPLEMENTED. `LotResult` in TraceabilitySearch shows all units consuming a lot via `consumptions` relation. `searchMaterialLot()` action returns consumption records with unit serial numbers.
- **Reverse genealogy (motor -> components)**: IMPLEMENTED. `UnitResult` in TraceabilitySearch shows `materialConsumptions` with lot numbers, material codes, quantities, station, and operator.
- **Operator productivity**: NOT IMPLEMENTED. No operator-level productivity metrics or reporting.
- **Event stream**: IMPLEMENTED. Events page (`src/app/dashboard/events/page.tsx`) shows real-time event feed with filtering by type, station, and unit. EventStream component with rich display.
- **Time series/high volume EOL data**: NOT IMPLEMENTED. Quality results stored as JSON but no time-series optimized storage or EOL-specific data handling.
- **Blob storage for raw test files**: NOT IMPLEMENTED. No file/blob storage for test data files.
- **Golden keys**: PARTIAL. Events table includes serial (via unitId), timestamp, stationId, operatorId. Material lots tracked per unit. No explicit "golden key" composite index or query.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Bulk production history browser (filter by date/model/WO) | High | Medium |
| Operator productivity metrics and reports | Medium | Medium |
| Time-series storage for high-volume EOL test data | Medium | High |
| Blob storage for raw test files | Low | High |
| Golden key composite query/view | Low | Medium |


## 12.6 Custom Report Builder

### Spec Requirements
- Admin builds reports by selecting fields
- Apply filters
- Schedule periodic email delivery
- No SQL required

### Current State
- **Custom report builder**: NOT IMPLEMENTED. No report builder UI exists.
- **Field selection**: NOT IMPLEMENTED.
- **Filters**: The analytics page has a date range selector (1/7/30 days). Events page has type/station/unit filters. But these are hardcoded, not configurable.
- **Scheduled email delivery**: NOT IMPLEMENTED. No scheduling or email infrastructure.
- **No-SQL interface**: NOT IMPLEMENTED.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Custom report builder UI (drag-and-drop fields) | Low | High |
| Dynamic filter builder | Low | High |
| Email delivery infrastructure | Medium | High |
| Scheduled report execution (cron/job queue) | Medium | High |


## Summary

### What Exists (Strong)
- Executive dashboard with KPI cards, production flow, bottleneck detection
- OEE dashboard with Availability x Performance x Quality breakdown and sparklines
- Pareto analysis (downtime by reason/station, NCR by defect/station, quality failures)
- Station detail drill-down with cycle time, pass rate, downtime, WIP
- Full forward/reverse material genealogy via traceability search
- Event stream with real-time filtering
- Shift handoff report with print support
- Inventory dashboard with low stock projections and expiring lot alerts
- Cycle time analytics with trend and outlier detection

### What Is Missing (Critical)
- SPC/Cp/Cpk with drift detection
- FPY trending over time
- NCR aging and severity analysis
- On-time delivery rate
- Purchase order tracking and lead time analysis
- Operator productivity reporting
- Custom report builder with scheduling
- Data export (CSV/Excel/PDF) from dashboards
- EOL-specific failure rate analysis
- Supplier quality scorecard
