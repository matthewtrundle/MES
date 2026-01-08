-- Event Enforcement Migration
-- Phase 1.2: Unique constraints for critical events
-- Phase 1.3: Append-only enforcement via triggers

-- =============================================================================
-- PARTIAL UNIQUE INDEX: Prevent duplicate operation_completed events
-- =============================================================================
-- This ensures a unit can only have one "operation_completed" event per station
-- (which represents completing a specific operation in the routing)

CREATE UNIQUE INDEX IF NOT EXISTS events_operation_completed_unique
ON events (event_type, unit_id, station_id)
WHERE event_type = 'operation_completed';

-- Also prevent duplicate operation_started events (same logic)
CREATE UNIQUE INDEX IF NOT EXISTS events_operation_started_unique
ON events (event_type, unit_id, station_id)
WHERE event_type = 'operation_started';

-- Prevent duplicate downtime_started events for same station without end
-- (can't start downtime twice at same station in same minute)
CREATE UNIQUE INDEX IF NOT EXISTS events_downtime_started_unique
ON events (event_type, station_id, DATE_TRUNC('minute', timestamp_utc))
WHERE event_type = 'downtime_started';

-- =============================================================================
-- APPEND-ONLY ENFORCEMENT: Prevent UPDATE/DELETE on events table
-- =============================================================================
-- Events are immutable facts - once written, they should never be modified

CREATE OR REPLACE FUNCTION prevent_event_modification()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'Events are immutable: UPDATE operations are not allowed on events table';
    ELSIF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'Events are immutable: DELETE operations are not allowed on events table';
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if exists (for idempotent migrations)
DROP TRIGGER IF EXISTS events_immutable_trigger ON events;

-- Create trigger to block UPDATE and DELETE
CREATE TRIGGER events_immutable_trigger
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW
EXECUTE FUNCTION prevent_event_modification();

-- =============================================================================
-- COMMENTS for documentation
-- =============================================================================
COMMENT ON INDEX events_operation_completed_unique IS 'Prevents duplicate operation completion events for same unit at same station';
COMMENT ON INDEX events_operation_started_unique IS 'Prevents duplicate operation start events for same unit at same station';
COMMENT ON INDEX events_downtime_started_unique IS 'Prevents duplicate downtime start events at same station within same minute';
COMMENT ON TRIGGER events_immutable_trigger ON events IS 'Enforces append-only semantics - events cannot be updated or deleted';
