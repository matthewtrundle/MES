import { PrismaClient } from '@prisma/client';

// Create a test-specific Prisma client with error handling
let prisma: PrismaClient;

try {
  prisma = new PrismaClient();
} catch {
  // Mock prisma client for unit tests that don't need DB
  prisma = {} as PrismaClient;
}

export { prisma };

/**
 * Clean up test data after tests
 */
export async function cleanupTestData(prefix: string = 'test-') {
  // Delete events with test prefixes
  await prisma.event.deleteMany({
    where: {
      OR: [
        { unitId: { startsWith: prefix } },
        { workOrderId: { startsWith: prefix } },
      ],
    },
  });

  // Delete test work orders
  await prisma.workOrder.deleteMany({
    where: { orderNumber: { startsWith: prefix } },
  });
}

/**
 * Create a test site if it doesn't exist
 */
export async function getOrCreateTestSite() {
  const existing = await prisma.site.findFirst({
    where: { name: 'Test Site' },
  });

  if (existing) return existing;

  return prisma.site.create({
    data: {
      name: 'Test Site',
      timezone: 'America/New_York',
      config: {},
      active: true,
    },
  });
}

/**
 * Create a test station
 */
export async function createTestStation(siteId: string, name: string = 'Test Station') {
  return prisma.station.create({
    data: {
      siteId,
      name,
      stationType: 'winding',
      sequenceOrder: 1,
      config: {},
      active: true,
    },
  });
}
