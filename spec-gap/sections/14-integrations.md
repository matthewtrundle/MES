# Section 14: Integration Requirements

## Source: Spec sections 14.1-14.4

## Requirements

| ID | Requirement | Status | Evidence | Gap Size |
|----|------------|--------|----------|----------|
| 14.1-01 | Documented REST API for all core data objects | NOT_IMPLEMENTED | API routes exist (`/api/health`, `/api/admin/work-orders`, `/api/station/[stationId]/operation`, `/api/ncr/[id]/disposition`, `/api/auth/track`) but there is no OpenAPI/Swagger spec, no generated API documentation, and no comprehensive CRUD endpoints for all data objects. Most business logic lives in Server Actions (`src/lib/actions/`), not in REST endpoints. | L |
| 14.1-02 | Third-party integration without code modification | NOT_IMPLEMENTED | No documented integration layer. Server Actions are tightly coupled to the Next.js frontend. External systems would need to call the few existing API routes, but most entities (units, materials, stations, quality checks) lack REST endpoints entirely. No plugin or adapter architecture. | L |
| 14.1-03 | Token-based authentication for API access | NOT_IMPLEMENTED | API routes use Clerk session-based auth via `requireRoleApi()` and `requireUserApi()` (`src/lib/auth/rbac.ts`). No API key or bearer token mechanism for machine-to-machine calls. Third-party systems cannot authenticate without a Clerk session. | M |
| 14.2-01 | Label printer integration (network print / direct API) | NOT_IMPLEMENTED | No printer SDK, print service, ZPL generation, or network print integration anywhere in the codebase. No label template system. | L |
| 14.2-02 | Laser engraver integration (serial transmission) | NOT_IMPLEMENTED | No serial port communication, no engraver driver or adapter. No model for engraving content templates. | L |
| 14.2-03 | Shipping carrier integration (UPS/FedEx/USPS APIs) | NOT_IMPLEMENTED | No shipping module, carrier API client, or rate/label functionality. No shipping-related models in schema. | L |
| 14.2-04 | Email integration (outbound notifications/reports) | NOT_IMPLEMENTED | No email library (`nodemailer`, SendGrid, etc.) in `package.json`. No notification service or email template system. The `src/app/api/auth/track/route.ts` emits login events but does not trigger notifications. | M |
| 14.2-05 | MQTT ingestion (production machines) | NOT_IMPLEMENTED | DECISIONS.md (DEC-005) explicitly defers MQTT to Phase-2. No MQTT client library in dependencies. No message broker configuration. Edge devices must use HTTP per current architecture. | L |
| 14.2-06 | Grafana or open-source data visualization | NOT_IMPLEMENTED | No Grafana configuration, no data source provisioning, no dashboard export. The app has built-in dashboards (`/dashboard`) using React components, but no external visualization tool integration. Docker Compose has only `postgres` and `app` services. | M |
| 14.3-01 | ERP/accounting export (future) | DEFERRED | DECISIONS.md (DEC-010) notes ERP integration as pending. "CSV stub for Phase-1, real integration in Phase-2." No export functionality implemented yet. Architecture supports this via event-driven design. | S |
| 14.3-02 | CAD/PLM import from Onshape (future) | DEFERRED | No Onshape API client or BOM import. `BillOfMaterial` model exists in schema which could accept imported data. No file upload or CAD parsing. | S |
| 14.3-03 | EOL test instrument data ingestion (future) | DEFERRED | No test instrument data model, no serial/USB data capture, no instrument protocol handlers. `QualityCheckResult.valuesJson` could store instrument readings but no automated path exists. | S |
| 14.3-04 | Servo press data ingestion (future) | DEFERRED | No servo press integration. Same gap as 14.3-03 -- no machine data capture infrastructure. | S |
| 14.3-05 | Balance machine data ingestion (future) | DEFERRED | No balance machine integration. Same gap as 14.3-03. | S |
| 14.3-06 | E-commerce/Shopify auto WO creation (future) | DEFERRED | No Shopify webhook receiver or e-commerce adapter. Work orders are created manually via admin UI or seed data. Webhook route matcher in middleware (`/api/webhook(.*)`) is defined as public but no handler exists. | S |
| 14.4-01 | Outbound webhooks for key events (EOL pass, WO complete, NCR opened) | NOT_IMPLEMENTED | Events are emitted to the `events` table via `emitEvent()` but there is no webhook dispatch system. No webhook registration model, no HTTP callback delivery, no retry logic. The middleware whitelists `/api/webhook` routes but no outbound webhook sender exists. | M |

## Coverage Summary

- **Total Requirements**: 17
- **IMPLEMENTED**: 0 (0%)
- **PARTIAL**: 0 (0%)
- **NOT_IMPLEMENTED**: 11 (65%)
- **DEFERRED**: 6 (35%)

## Architecture Notes

The codebase's event-driven architecture (`events` table with `emitEvent()`) provides a solid foundation for future integration work. Events are immutable, timestamped, and carry structured payloads. Adding outbound webhooks or message queue dispatch on top of this event stream is architecturally straightforward. The main gap is the lack of a documented, token-authenticated REST API layer -- most business logic bypasses REST endpoints entirely in favor of Next.js Server Actions.

Key files:
- `/Users/matthewrundle/Documents/MES-local/src/app/api/` - existing API routes (health, work orders, NCR, station, simulation, auth, AI)
- `/Users/matthewrundle/Documents/MES-local/src/lib/auth/rbac.ts` - auth layer (Clerk session-based, no API tokens)
- `/Users/matthewrundle/Documents/MES-local/src/lib/db/events.ts` - event emission system
- `/Users/matthewrundle/Documents/MES-local/src/middleware.ts` - route protection (webhook routes whitelisted but unimplemented)
- `/Users/matthewrundle/Documents/MES-local/DECISIONS.md` - DEC-005 (no MQTT in Phase-1), DEC-010 (ERP integration pending)
