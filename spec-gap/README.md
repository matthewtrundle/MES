# MES Spec Gap Analysis — Session Protocol

## Purpose

This directory contains a systematic comparison of the MES product specification (`SPEC.md`) against the current codebase implementation. It identifies gaps, sizes them, and provides a prioritized implementation roadmap.

## How to Pick Up Work

1. **Read `STATUS.md`** — see which sections are `not_started`, `in_progress`, or `complete`
2. **Pick the next `not_started` section** (or resume an `in_progress` one)
3. **Read `SPEC.md`** — find the relevant section (sections map 1:1 to spec headings)
4. **Analyze the codebase** — search for implementation evidence in:
   - `prisma/schema.prisma` — data models
   - `src/lib/actions/` — server actions / business logic
   - `src/app/` — pages and routes
   - `src/components/` — UI components
   - `src/app/api/` — API endpoints
5. **Write the section analysis** into `sections/NN-section-name.md` using the template below
6. **Update `STATUS.md`** — mark the section as `complete` with the date

## Section Analysis Template

```markdown
# Section NN: [Name]

## Source
Spec sections: X.Y through X.Z (lines NN-MM of SPEC.md)

## Requirements

| ID | Requirement | Status | Evidence | Notes |
|----|-------------|--------|----------|-------|
| REQ-NN-001 | Description | IMPLEMENTED / PARTIAL / NOT_IMPLEMENTED / DEFERRED | File paths | Details |

## Coverage Summary
- Total: N requirements
- Implemented: N (N%)
- Partial: N (N%)
- Not Implemented: N (N%)
- Deferred: N (N%)

## Gaps (Detail)

### GAP-NN-001: [Title]
- **Current State**: What exists today
- **Missing**: What the spec requires that isn't built
- **Size**: XS / S / M / L / XL / XXL
- **Dependencies**: Other gaps or external systems needed
- **Schema Changes**: Yes/No — describe if yes
- **Risk**: Low / Medium / High
```

## Status Classifications

| Status | Meaning |
|--------|---------|
| `IMPLEMENTED` | Fully built, code evidence found |
| `PARTIAL` | Some implementation exists, missing key aspects |
| `NOT_IMPLEMENTED` | No evidence in codebase |
| `DEFERRED` | Explicitly excluded per DECISIONS.md or spec §16 |

## Gap Sizing Guide

| Size | Effort | Examples |
|------|--------|---------|
| XS | < 2 hours | Add a field, minor UI tweak |
| S | 2-8 hours | New component, simple server action |
| M | 1-3 days | New module page, schema migration + actions |
| L | 3-7 days | New feature area (e.g., shipping module) |
| XL | 1-2 weeks | Major subsystem (e.g., IQC module) |
| XXL | 2+ weeks | Cross-cutting system (e.g., equipment integration framework) |

## Session Plan

| Session | Sections | Status |
|---------|----------|--------|
| 1 | 01-03 (Overview, Procurement, Receiving) | |
| 2 | 04-06 (IQC, Part Master/BOM, Inventory) | |
| 3 | 07-08 (Work Orders, Production Data Capture) | |
| 4 | 09-11 (Serialization, EOL, Shipping) | |
| 5 | 12-13 (Analytics, Admin) | |
| 6 | 14-17 (Integrations, Non-Functional, Future, Tests) | |
| 7 | Generate GAP-MATRIX.md and PHASE-MAP.md | |

## Key Reference Files

- `DECISIONS.md` — intentional exclusions (DEC-005: no MQTT, etc.)
- `CLAUDE.md` — development rules and Phase-1 scope
- `prisma/schema.prisma` — 30+ models, primary data model evidence
