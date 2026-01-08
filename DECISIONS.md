# MES MVP - Architecture Decisions

This document records key architecture and technology decisions for the MES MVP.

## Decision Log

### DEC-001: Full-Stack Next.js Architecture
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to choose between separate backend (FastAPI/NestJS) vs. unified Next.js architecture.

**Decision**: Use Next.js 14 App Router with Server Actions for the full stack.

**Rationale**:
- Simpler deployment (single container)
- Native Clerk integration
- Server Components for efficient data fetching
- Sufficient for Phase-1 scale (~100 units/day)
- Can add separate workers later if needed

**Consequences**:
- All business logic in Server Actions
- No separate API documentation (use TypeScript types)
- May need to extract services in Phase-2 if scale demands

---

### DEC-002: PostgreSQL with Prisma ORM
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to choose database and access pattern.

**Decision**: PostgreSQL 16 with Prisma ORM for type-safe database access.

**Rationale**:
- JSONB for flexible event payloads
- Strong type safety with Prisma
- Excellent migration tooling
- Triggers for derived state updates
- Industry standard for manufacturing systems

**Consequences**:
- Need to manage Prisma migrations carefully
- Some complex queries may need raw SQL
- PostgreSQL-specific features (JSONB, triggers) lock us in

---

### DEC-003: Event-Driven with Synchronous Triggers
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to decide how derived state is updated from events.

**Decision**: Use PostgreSQL triggers for synchronous state updates in Phase-1.

**Alternatives Considered**:
1. Application-level event handlers (async)
2. Transactional outbox pattern
3. Change Data Capture (CDC)

**Rationale**:
- Triggers are simple and reliable
- No separate queue infrastructure needed
- Consistent reads immediately after writes
- Sufficient for Phase-1 scale

**Consequences**:
- Tight coupling between events and triggers
- May need to migrate to async if scale increases
- Trigger debugging can be challenging

---

### DEC-004: Clerk for Authentication
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need authentication with role-based access control.

**Decision**: Use Clerk with custom role metadata.

**Rationale**:
- Native Next.js integration
- Built-in user management UI
- Custom claims for roles
- Session handling included
- Per RAG authority hierarchy recommendation

**Consequences**:
- Vendor dependency
- Need to sync users to local table for joins
- Custom role management via Clerk dashboard or API

---

### DEC-005: No Node-RED in Phase-1
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to decide on edge collector implementation.

**Decision**: Use Next.js API routes for HTTP-based edge ingestion. Defer Node-RED to Phase-2.

**Rationale**:
- Simpler architecture
- HTTP sufficient for Phase-1 demo
- Can add Node-RED later for MQTT/PLC
- Reduces deployment complexity

**Consequences**:
- No MQTT support in Phase-1
- Edge devices must use HTTP
- Will need architecture change for real PLCs

---

### DEC-006: Tablet-First Operator UI
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to design operator interface.

**Decision**: Design for tablet-first with large touch targets.

**Rationale**:
- Factory floor reality
- Reduces operator errors
- Faster training
- Works on desktop too

**Consequences**:
- Large buttons (min 44px touch targets)
- Limited data density per screen
- Must test on actual tablets

---

### DEC-007: Idempotency via Unique Keys
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need to prevent duplicate events on network retries.

**Decision**: Use `idempotencyKey` column with unique constraint on events table.

**Rationale**:
- Simple to implement
- Database-level guarantee
- Standard pattern for event systems
- Handles Wi-Fi hiccups gracefully

**Consequences**:
- Clients must provide idempotency keys
- Need key generation strategy (UUID or deterministic)
- Must handle unique constraint violations gracefully

---

### DEC-008: shadcn/ui Component Library
**Date**: 2026-01-08
**Status**: Accepted

**Context**: Need UI component library.

**Decision**: Use shadcn/ui with Tailwind CSS.

**Rationale**:
- Accessible by default
- Customizable (we own the code)
- Tailwind integration
- Good tablet-friendly components
- Active community

**Consequences**:
- Components copied into codebase
- Need to style for tablet
- Must maintain components ourselves

---

## Pending Decisions

### DEC-009: OEE Calculation Approach
**Status**: Pending

**Context**: Need to decide how to calculate OEE metrics.

**Options**:
1. Real-time calculation from events
2. Periodic materialized view refresh
3. Pre-aggregated tables updated by triggers

**Notes**: Defer until dashboard implementation.

---

### DEC-010: ERP Integration Pattern
**Status**: Pending

**Context**: Need to decide on ERP work order import.

**Options**:
1. CSV file upload
2. Webhook endpoint
3. Polling external API

**Notes**: CSV stub for Phase-1, real integration in Phase-2.

---

## Decision Template

```markdown
### DEC-XXX: Title
**Date**: YYYY-MM-DD
**Status**: Proposed | Accepted | Deprecated | Superseded

**Context**: What is the issue?

**Decision**: What was decided?

**Rationale**: Why this decision?

**Consequences**: What happens as a result?
```
