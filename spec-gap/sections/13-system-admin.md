# Section 13: System Administration -- Gap Analysis

## 13.1 User Management

### Spec Requirements
- Create/edit/deactivate accounts
- RBAC with defined permissions per role
- 2FA support
- Audit log of logins/actions

### Current State
- **Create/edit/deactivate accounts**: PARTIAL. User model (`prisma/schema.prisma`) has `active` boolean for deactivation. Users are auto-created on first Clerk login (`src/lib/auth/rbac.ts` - `getCurrentUser()`). Admin can assign users to stations via `assignUserToStation()` (`src/lib/actions/admin/users.ts`). No admin UI page for user CRUD -- no `/admin/users` page exists, and the AdminSidebar does not list a "Users" link.
- **RBAC with defined permissions per role**: IMPLEMENTED. Three roles defined in Prisma enum: `operator`, `supervisor`, `admin`. Server-side enforcement via `requireRole()` in every server action. Admin layout requires `admin` role. Role hierarchy helpers (`isOperatorOrAbove`, `isSupervisorOrAbove`, `isAdmin`). Both page-level and action-level checks.
- **2FA support**: DELEGATED TO CLERK. Clerk handles 2FA configuration. No custom 2FA implementation in the MES codebase. Whether 2FA is actually enabled depends on Clerk tenant configuration.
- **Audit log of logins/actions**: PARTIAL. `AuditLog` model exists with userId, action, entityType, entityId, beforeJson, afterJson, timestamp. Login tracking exists via `/api/auth/track/route.ts`. Admin actions (station assignment, config changes) log to audit trail. No admin UI to view audit logs.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Admin UI for user management (list, create, edit, deactivate) | High | Medium |
| Admin sidebar link for user management | High | Low |
| Admin UI to view/search audit logs | High | Medium |
| Permission matrix documentation per role | Low | Low |
| Verify 2FA is enabled in Clerk configuration | Medium | Low |


## 13.2 Configuration Management

### Spec Requirements (all via admin UI, no code)
- Motor models + BOMs
- Process step definitions + data capture forms
- Serial number formats
- Label templates
- CTQ dimension templates
- Inventory reorder params
- Workstation definitions
- Notification rules

### Current State
- **Motor models + BOMs**: PARTIAL. BOM editor exists (`src/app/admin/bom/page.tsx`, `src/components/admin/BomEditor.tsx`). BillOfMaterial model links routing + station + materialCode with qtyPerUnit. However, there is no separate "Motor Model" entity -- products are identified by `productCode` on WorkOrder and `Routing`. No UI to manage motor model metadata.
- **Process step definitions**: PARTIAL. WorkOrderOperation model defines process steps per WO (station, sequence, estimatedMinutes). Routing model stores operations as JSON. Admin can manage work orders (`/admin/work-orders`). No dedicated process step editor independent of work orders.
- **Data capture forms**: PARTIAL. QualityCheckDefinition has `parameters` JSON field for check-specific config (limits, options). Admin quality checks page (`/admin/quality-checks`) with QualityCheckForm and QualityCheckTable components for CRUD. But data capture forms are limited to quality checks -- no general-purpose form builder for arbitrary process data.
- **Serial number formats**: NOT IMPLEMENTED. Serial numbers are generated in code but there is no admin UI to configure serial number patterns/formats.
- **Label templates**: NOT IMPLEMENTED. No label template model or admin UI.
- **CTQ dimension templates**: NOT IMPLEMENTED. No CTQ-specific templates. Quality checks capture measurements but without formal CTQ classification.
- **Inventory reorder params**: NOT IMPLEMENTED. No reorder point, min/max levels, or safety stock configuration. Low stock alerts use consumption-rate projection.
- **Workstation definitions**: IMPLEMENTED. Admin stations page (`/admin/stations`) with StationForm and StationTable for full CRUD. Station model includes name, type, sequence, config JSON, active flag.
- **Notification rules**: NOT IMPLEMENTED. No notification rule model or configuration UI.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Motor Model entity with metadata management | Medium | Medium |
| Process step editor (independent of WOs) | Medium | Medium |
| General-purpose data capture form builder | Low | High |
| Serial number format configuration UI | Medium | Medium |
| Label template designer and management | Medium | High |
| CTQ dimension template management | Medium | Medium |
| Inventory reorder point/min/max configuration | High | Medium |
| Notification rules configuration UI | High | High |


## 13.3 Data Retention

### Spec Requirements
- Indefinite retention by default
- Configurable archival to lower-cost storage
- Export in CSV/Excel/PDF

### Current State
- **Indefinite retention**: IMPLICIT. PostgreSQL stores all data indefinitely. No TTL or automatic deletion policies. Events are immutable by design (per CLAUDE.md). This satisfies the requirement by default.
- **Configurable archival**: NOT IMPLEMENTED. No archival strategy, no cold storage tier, no data lifecycle management.
- **Export in CSV/Excel/PDF**: PARTIAL. Shift report page has a `PrintButton` component for browser print/PDF. No CSV or Excel export functionality anywhere. No download buttons on dashboards or tables.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| CSV export from inventory, production, quality tables | High | Medium |
| Excel export capability | Medium | Medium |
| PDF export from dashboards/reports | Medium | Medium |
| Data archival configuration and cold storage migration | Low | High |
| Data retention policy management UI | Low | Medium |


## 13.4 Audit Trail

### Spec Requirements
- Every data change logged (previous value, new value, user, timestamp)
- Immutable audit trail
- Safety-critical changes require reason code

### Current State
- **Data change logging**: PARTIAL. `AuditLog` model captures: userId, action (create/update/delete/config_change), entityType, entityId, beforeJson, afterJson, timestamp. `logAuditTrail()` utility in `src/lib/db/audit.ts`. Used in user station assignment. Config changes also emit `config_changed` events.
- **Coverage**: PARTIAL. Audit trail is used in:
  - User station assignment (`src/lib/actions/admin/users.ts`)
  - Other admin CRUD actions use `logAuditTrail` (stations, downtime reasons, quality checks reference it)
  - Events table provides an additional immutable audit layer for operational events
  - Not all data changes are guaranteed to go through audit logging
- **Immutability**: PARTIAL. No database-level immutability constraint (no triggers preventing UPDATE/DELETE on audit_logs). Application-level immutability via insert-only pattern.
- **Reason codes for safety-critical changes**: NOT IMPLEMENTED. No reason code field on AuditLog. No UI prompt for justification on sensitive changes.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Ensure ALL data changes go through audit logging | High | Medium |
| Admin UI to browse/search audit logs | High | Medium |
| Database-level immutability (triggers or RBAC on audit_logs) | Medium | Low |
| Reason code field on AuditLog for safety-critical changes | High | Low (schema + UI) |
| UI prompt requiring reason for safety-critical config changes | High | Medium |


## 13.5 Notifications

### Spec Requirements
- In-app dashboard alerts
- Email notifications
- Optional SMS
- Triggers: new IQC pending, low stock, WO overdue, EOL failure, NCR opened/overdue, PO delivery overdue, new user account

### Current State
- **In-app alerts**: PARTIAL. AI Insights panel on main dashboard shows unacknowledged recommendations/anomalies (`AIInsight` model). Active downtime shown as alert banner. Andon board (`src/app/andon/page.tsx`) and AlertBanner component exist. These are display-only -- not a general notification system.
- **Email notifications**: NOT IMPLEMENTED. No email service integration (no SendGrid, SES, etc.). No email templates or sending logic.
- **SMS notifications**: NOT IMPLEMENTED.
- **Trigger-based notifications**: NOT IMPLEMENTED. No notification trigger engine. Low stock is calculated on page load but not pushed. No background job monitoring for threshold breaches.

### Specific Trigger Analysis:
| Trigger | Status |
|---------|--------|
| New IQC pending | NOT IMPLEMENTED (no IQC workflow) |
| Low stock | Dashboard shows alerts visually; no push notification |
| WO overdue | WO has `dueDate` but no overdue detection/notification |
| EOL failure | NOT IMPLEMENTED |
| NCR opened | Event emitted but no notification sent |
| NCR overdue | NOT IMPLEMENTED (no aging threshold) |
| PO delivery overdue | NOT IMPLEMENTED (no PO model) |
| New user account | User auto-created via Clerk; no notification |

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| Notification model (type, recipient, channel, status, read) | High | Medium |
| In-app notification center (bell icon, unread count, list) | High | Medium |
| Email notification infrastructure (SMTP/SES integration) | High | High |
| Optional SMS integration (Twilio or similar) | Low | Medium |
| Background notification trigger engine (job queue) | High | High |
| Notification rules/preferences per user | Medium | Medium |
| All specified trigger implementations (8 triggers) | High | High |


## 13.6 CI/CD

### Spec Requirements
- Multiple test environments
- dev -> test -> production pipeline

### Current State
- **Test environments**: NOT VERIFIED. Docker Compose exists for local development. No evidence of staging/test environment configurations in codebase.
- **CI/CD pipeline**: NOT IMPLEMENTED in codebase. No `.github/workflows`, `Jenkinsfile`, or similar CI configuration found. No deployment automation scripts.
- **Testing**: PARTIAL. `tests/integration/quality-ncr-flow.test.ts` exists. CLAUDE.md references `npm run test` and `npm run test:e2e`. Test coverage appears minimal.

### Gaps
| Gap | Priority | Effort |
|-----|----------|--------|
| CI/CD pipeline configuration (GitHub Actions or similar) | High | Medium |
| Staging/test environment Docker Compose or k8s configs | Medium | Medium |
| Environment-specific configuration management | Medium | Low |
| Automated test suite expansion | Medium | High |
| Database migration strategy for multi-environment | Medium | Medium |


## Summary

### What Exists (Strong)
- RBAC with three roles enforced at server-action level
- Clerk-based authentication with auto-provisioning
- AuditLog model with before/after JSON capture
- Admin UI for stations, downtime reasons, quality checks, work orders, materials, BOMs, kitting
- Event-driven architecture provides operational audit trail
- Shift model for site-level shift definitions
- User station assignment with audit logging

### What Is Missing (Critical)
- User management admin page (list/create/edit/deactivate users)
- Audit log viewer in admin UI
- Notification system (in-app, email, SMS) with trigger engine
- Data export (CSV/Excel/PDF) from any page
- Serial number format configuration
- Inventory reorder point/min/max parameters
- Label template management
- CI/CD pipeline
- Reason codes on safety-critical audit entries
- Notification rules and preferences configuration
- Motor model entity management
