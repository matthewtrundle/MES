# MES MVP - Claude Code Development Rules

This file provides guidance to Claude Code when working with the MES MVP codebase.

## Project Overview

This is a **Phase-1 Manufacturing Execution System (MES) MVP** for motor assembly operations. It follows an **event-driven architecture** aligned with ISA-95 Level 3 principles.

## Architecture Principles

### Event-First Design (NON-NEGOTIABLE)
- **Events are immutable facts** - never modify events after creation
- **All critical actions emit events** to the `events` table
- **State is derived** from events via PostgreSQL triggers or materialized views
- **Idempotency keys** prevent duplicate events on retries

### ISA-95 Alignment
- MES **executes**; ERP **plans** (we don't do scheduling)
- Focus on **Level 3**: work orders, units, stations, quality, downtime
- Trust in data > dashboard sophistication

### RBAC Enforcement
- **Always check roles in Server Actions** using `requireRole()`
- **Never rely on UI-only permissions** - backend must enforce
- Three roles: `operator`, `supervisor`, `admin`
- All config changes logged to audit trail

## Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL 16 with Prisma ORM
- **Auth**: Clerk with custom roles
- **UI**: shadcn/ui (Tailwind-based)
- **Deployment**: Docker Compose

## File Structure Conventions

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Clerk auth routes
│   ├── (operator)/        # Operator UI (tablet-first)
│   ├── (supervisor)/      # Supervisor dashboards
│   ├── (admin)/           # Admin configuration
│   └── api/               # API routes for integration
├── lib/
│   ├── db/                # Database utilities
│   │   ├── prisma.ts     # Prisma client singleton
│   │   └── events.ts     # Event emission utilities
│   ├── auth/              # Authentication utilities
│   │   └── rbac.ts       # Role checking
│   └── actions/           # Server Actions
├── components/
│   ├── operator/          # Tablet-optimized components
│   ├── supervisor/        # Dashboard components
│   └── ui/                # shadcn/ui components
└── prisma/
    ├── schema.prisma      # Database schema
    └── seed.ts            # Demo data seed
```

## Coding Standards

### Server Actions
```typescript
// Always check authorization first
'use server';

import { requireRole } from '@/lib/auth/rbac';
import { emitEvent } from '@/lib/db/events';

export async function releaseWorkOrder(id: string) {
  const user = await requireRole(['admin', 'supervisor']);

  // Business logic...

  await emitEvent({
    eventType: 'work_order_released',
    workOrderId: id,
    operatorId: user.id,
    payload: { ... },
    source: 'ui',
  });
}
```

### Event Emission
```typescript
// Always emit events for critical operations
await emitEvent({
  eventType: string;      // e.g., 'operation_completed'
  siteId: string;         // Always required
  stationId?: string;     // When station-specific
  workOrderId?: string;   // When work-order-specific
  unitId?: string;        // When unit-specific
  operatorId?: string;    // Who performed the action
  payload: Record<string, unknown>;  // Event-specific data
  source: 'ui' | 'edge' | 'integration';
  idempotencyKey?: string; // For retry safety
});
```

### UI Components
- **Operator UI**: Large touch targets (min 44px), clear state indicators
- **Server Components** for data fetching
- **Client Components** only for interactivity
- Use `use client` directive sparingly

## Event Taxonomy

Required events for Phase-1:
- `work_order_imported`, `work_order_released`
- `unit_created`, `unit_serial_assigned`
- `operation_started`, `operation_completed`, `operation_failed`
- `quality_check_recorded`
- `ncr_created`, `ncr_dispositioned`
- `downtime_started`, `downtime_reason_selected`, `downtime_ended`
- `scrap_recorded`, `rework_created`, `rework_completed`
- `material_lot_consumed`
- `config_changed`, `user_login`

## Testing Requirements

- Unit tests for event emission logic
- Unit tests for RBAC middleware
- Integration tests for core execution flows
- E2E smoke test for demo walkthrough

## Anti-Patterns to Avoid

- **Never mutate events** - they are immutable facts
- **Never skip RBAC checks** in Server Actions
- **Never hardcode credentials** - use environment variables
- **Never trust client-side role checks** alone
- **Avoid over-engineering** - this is Phase-1 MVP
- **Avoid complex dependency graphs** - keep it simple

## Demo Requirements

The system must support the 7-minute demo script:
1. Admin releases work order
2. Operator scans serial, captures lots, completes operations
3. Operator logs downtime with reason
4. Unit fails quality check, NCR created
5. Supervisor dispositions NCR
6. Serial traceability search
7. Dashboard shows metrics

## Commands

```bash
# Development
npm run dev           # Start Next.js dev server
docker compose up -d  # Start PostgreSQL

# Database
npx prisma migrate dev   # Run migrations
npx prisma db seed       # Seed demo data
npx prisma studio        # Database GUI

# Testing
npm run test          # Run unit tests
npm run test:e2e      # Run E2E tests
```
