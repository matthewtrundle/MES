# Section 15: Non-Functional Requirements

## Source: Spec sections 15.1-15.6

## Requirements

| ID | Requirement | Status | Evidence | Gap Size |
|----|------------|--------|----------|----------|
| 15.1-01 | 99.5% uptime | PARTIAL | Docker Compose deployment with health checks on Postgres (`pg_isready`). `/api/health` endpoint checks DB connectivity, entity counts, and memory usage. `/api/ready` endpoint exists. However, no HA configuration, no load balancer, no automated failover, and no uptime monitoring. Single-container deployment. | M |
| 15.1-02 | Maintenance windows outside production hours | NOT_IMPLEMENTED | No maintenance mode flag, no scheduled window configuration, no user-facing maintenance banner. `Shift` model exists in schema but is not used for maintenance scheduling. | S |
| 15.1-03 | Offline fallback mode for operators | NOT_IMPLEMENTED | No service worker, no PWA manifest, no offline-first data caching, no `next-pwa` dependency. Operator UI requires live network connection. | L |
| 15.2-01 | 2-second page loads | PARTIAL | Next.js App Router with Server Components provides good baseline performance. Server-side rendering avoids client-side data waterfall. No explicit performance testing, no Lighthouse CI, no server-side caching layer (Redis), no CDN configuration. | S |
| 15.2-02 | 5-second dashboard queries for 5 years of data | NOT_IMPLEMENTED | Database indexes exist on key columns (`events`, `units`, `work_orders`) which helps. However, no materialized views, no time-based partitioning, no query optimization for large historical datasets. Current queries in `analytics.ts` are not optimized for multi-year scale. | M |
| 15.2-03 | 20 concurrent users | PARTIAL | Prisma connection pooling supports concurrent requests. Single Next.js instance with Node.js event loop can handle 20 users. No load testing performed, no connection pool tuning, no horizontal scaling configuration. Docker Compose runs single `app` instance. | S |
| 15.3-01 | TLS 1.2+ | NOT_IMPLEMENTED | No TLS configuration in Docker Compose or app. Development runs on HTTP. No reverse proxy (nginx/Caddy) configured for TLS termination. Deployment to a hosting platform with managed TLS would satisfy this. | M |
| 15.3-02 | Encryption at rest | NOT_IMPLEMENTED | PostgreSQL data stored in Docker volume without encryption. No disk encryption configuration. Would depend on infrastructure/hosting provider. | M |
| 15.3-03 | Authenticated login | IMPLEMENTED | Clerk authentication fully integrated. `src/middleware.ts` protects routes. `getCurrentUser()` resolves user from Clerk session. Users auto-created on first login with role from Clerk metadata. Demo mode bypasses auth for development. | -- |
| 15.3-04 | API-level RBAC | IMPLEMENTED | `requireRole()` and `requireRoleApi()` in `src/lib/auth/rbac.ts` enforce role checks. Three roles defined: `operator`, `supervisor`, `admin`. All Server Actions and API routes check authorization. RBAC tests exist in `tests/integration/rbac.test.ts`. | -- |
| 15.3-05 | 30-day security patch SLA | NOT_IMPLEMENTED | No documented patch policy, no dependency scanning (Dependabot, Snyk), no automated security updates. `package.json` dependencies have no pinned vulnerability scanning. | S |
| 15.4-01 | New data fields via admin config (no release) | PARTIAL | `Site.config`, `Station.config` are JSON fields that can store arbitrary data. `QualityCheckDefinition.parameters` is flexible JSON. However, there is no admin UI for adding custom fields to entities, and the schema is fixed by Prisma migrations. | M |
| 15.4-02 | New process steps via config | PARTIAL | `Routing.operations` is a JSON array of `{stationId, sequence, estimatedMinutes}`. New steps can be added by modifying routing config. `WorkOrderOperation` records are created from routing. However, adding new station types or fundamentally different process steps requires code changes. | S |
| 15.4-03 | New motor model via admin | IMPLEMENTED | Work orders specify `productCode` and link to `Routing` with `productCode`. `BillOfMaterial` is per routing. Admin can create new routings with different product codes, stations, and BOMs via existing admin actions. | -- |
| 15.4-04 | Documented data model for 1-day integration onboarding | NOT_IMPLEMENTED | Prisma schema (`prisma/schema.prisma`) is well-commented and serves as data model documentation. `DECISIONS.md` documents architecture. However, no dedicated integration guide, no API reference, no data dictionary, no ERD diagram. | M |
| 15.5-01 | 5-minute operator training | PARTIAL | Operator UI (`src/components/operator/`) uses large touch targets, clear state indicators, and a station-centric workflow. `ActiveUnit.tsx` and `MaterialConsumptionDialog.tsx` provide guided flows. However, no in-app tutorial, no help tooltips, no onboarding wizard. | S |
| 15.5-02 | 5-inch smartphone with gloves | PARTIAL | Tablet-first design (DEC-006) with large touch targets (min 44px per CLAUDE.md). However, no explicit responsive testing for 5-inch screens, no glove-mode testing, no minimum touch target audit. CSS uses Tailwind responsive utilities. | S |
| 15.5-03 | Light/dark mode | NOT_IMPLEMENTED | `next-themes` is in `package.json` dependencies. `src/components/ui/sonner.tsx` references theme. CSS in `globals.css` defines dark-mode variables. However, no `ThemeProvider` wrapper found in layout components, no theme toggle UI component, no user preference persistence. Dark mode support is partially wired but not functional. | M |
| 15.5-04 | Plain-language errors | PARTIAL | API routes return descriptive error messages (e.g., "Invalid disposition. Must be one of: rework, scrap, use_as_is, defer"). `rbac.ts` returns "Forbidden: Insufficient permissions". Some errors are still technical (e.g., Prisma errors may leak). No systematic error message review or i18n. | S |
| 15.6-01 | No production record deletion | PARTIAL | No delete endpoints exist for production records (units, events, quality results). Events are immutable by design. `AuditLog` tracks changes. However, Prisma `delete` operations are used in admin actions for config entities (`shifts.ts`, `stations.ts`, `downtime-reasons.ts`, `quality-checks.ts`). No soft-delete pattern on production data. | S |
| 15.6-02 | Permanent serial numbers | IMPLEMENTED | `Unit.serialNumber` has `@unique` constraint. Serial numbers are assigned on creation and never modified in any action or API. Event trail captures serial number in payloads for full traceability. | -- |
| 15.6-03 | Immutable inventory transactions | IMPLEMENTED | `UnitMaterialConsumption` records are create-only (no update/delete actions). `Event` table is append-only with unique `idempotencyKey`. Material lot quantities are decremented but consumption records are permanent. | -- |
| 15.6-04 | Daily backups with 30-day PITR | NOT_IMPLEMENTED | No backup configuration in Docker Compose. PostgreSQL runs with a Docker volume (`pgdata`) but no backup cron, no WAL archiving, no PITR setup. Would require infrastructure-level configuration or managed database service. | M |

## Coverage Summary

- **Total Requirements**: 23
- **IMPLEMENTED**: 5 (22%)
- **PARTIAL**: 10 (43%)
- **NOT_IMPLEMENTED**: 8 (35%)
- **DEFERRED**: 0 (0%)

## Architecture Notes

The codebase has strong foundations for many non-functional requirements: event-driven immutability, Clerk-based RBAC, Prisma schema with good indexing, and Server Components for performance. The primary gaps are in operational infrastructure (TLS, backups, monitoring, offline mode) and developer experience (API documentation, integration guides). These are largely deployment and DevOps concerns rather than application architecture issues.

Key files:
- `/Users/matthewrundle/Documents/MES-local/src/lib/auth/rbac.ts` - RBAC enforcement (15.3-03, 15.3-04)
- `/Users/matthewrundle/Documents/MES-local/src/middleware.ts` - route protection
- `/Users/matthewrundle/Documents/MES-local/src/app/api/health/route.ts` - health check endpoint (15.1-01)
- `/Users/matthewrundle/Documents/MES-local/prisma/schema.prisma` - data model with indexes, JSON config fields (15.4-01, 15.6-01)
- `/Users/matthewrundle/Documents/MES-local/docker-compose.yml` - single-instance deployment (15.1-01, 15.6-04)
- `/Users/matthewrundle/Documents/MES-local/Dockerfile` - multi-stage production build with non-root user
- `/Users/matthewrundle/Documents/MES-local/src/lib/db/audit.ts` - audit trail logging (15.6-01)
- `/Users/matthewrundle/Documents/MES-local/DECISIONS.md` - DEC-006 tablet-first UI (15.5-01, 15.5-02)
