import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma, getOrCreateTestSite, createTestStation, cleanupTestData } from '../helpers/db';
import { emitEvent, generateIdempotencyKey, type EventType } from '@/lib/db/events';

describe('Event System', () => {
  let testSiteId: string;
  let testStationId: string;

  beforeAll(async () => {
    const site = await getOrCreateTestSite();
    testSiteId = site.id;
    const station = await createTestStation(testSiteId, 'Event Test Station');
    testStationId = station.id;
  });

  afterAll(async () => {
    await cleanupTestData('test-event-');
    await prisma.$disconnect();
  });

  describe('emitEvent', () => {
    it('should create an event with all required fields', async () => {
      const eventType: EventType = 'config_changed';
      const eventData = {
        eventType,
        siteId: testSiteId,
        stationId: testStationId,
        payload: { testKey: 'testValue' },
        source: 'ui' as const,
        idempotencyKey: `test-event-${Date.now()}`,
      };

      const event = await emitEvent(eventData);

      expect(event).toBeDefined();
      expect(event.eventType).toBe('config_changed');
      expect(event.siteId).toBe(testSiteId);
      expect(event.stationId).toBe(testStationId);
      expect(event.payload).toEqual({ testKey: 'testValue' });
    });

    it('should prevent duplicate events with same idempotency key', async () => {
      const idempotencyKey = `test-duplicate-${Date.now()}`;
      const eventType: EventType = 'user_login';
      const eventData = {
        eventType,
        siteId: testSiteId,
        payload: { attempt: 1 },
        source: 'ui' as const,
        idempotencyKey,
      };

      // First event should succeed
      const event1 = await emitEvent(eventData);
      expect(event1).toBeDefined();

      // Second event with same key should return existing event
      const event2 = await emitEvent({ ...eventData, payload: { attempt: 2 } });
      expect(event2.id).toBe(event1.id);
      expect(event2.payload).toEqual({ attempt: 1 }); // Should be original payload
    });
  });

  describe('generateIdempotencyKey', () => {
    it('should generate deterministic keys for same inputs within same minute', async () => {
      const entityId = 'test-entity-123';
      const eventType: EventType = 'config_changed';

      // Keys generated in same minute should be same
      const key1 = generateIdempotencyKey(eventType, entityId);
      const key2 = generateIdempotencyKey(eventType, entityId);

      // They should be equal (within same minute)
      expect(key1).toBe(key2);
    });

    it('should generate different keys for different event types', () => {
      const entityId = 'test-entity-123';
      const eventTypeA: EventType = 'operation_started';
      const eventTypeB: EventType = 'operation_completed';

      const key1 = generateIdempotencyKey(eventTypeA, entityId);
      const key2 = generateIdempotencyKey(eventTypeB, entityId);

      expect(key1).not.toBe(key2);
    });

    it('should generate different keys for different entities', () => {
      const eventType: EventType = 'unit_created';
      const key1 = generateIdempotencyKey(eventType, 'entity-1');
      const key2 = generateIdempotencyKey(eventType, 'entity-2');

      expect(key1).not.toBe(key2);
    });
  });
});
