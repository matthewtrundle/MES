import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

/**
 * Readiness probe endpoint for Kubernetes-style deployment.
 * Returns 200 only when the application is fully ready to serve traffic:
 * - Database is connected
 * - Migrations have been applied (checked by looking for key tables)
 * - Seed data exists (at least one site configured)
 */
export async function GET() {
  const checks: Record<string, { status: 'pass' | 'fail'; message?: string }> = {};

  try {
    // Check 1: Database connectivity
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'pass' };
  } catch (error) {
    checks.database = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }

  try {
    // Check 2: Migrations applied (check for events table)
    await prisma.$queryRaw`SELECT 1 FROM events LIMIT 1`;
    checks.migrations = { status: 'pass' };
  } catch (error) {
    checks.migrations = {
      status: 'fail',
      message: 'Events table not found - migrations may not be applied',
    };
  }

  try {
    // Check 3: Seed data exists (at least one site)
    const siteCount = await prisma.site.count();
    if (siteCount > 0) {
      checks.seedData = { status: 'pass' };
    } else {
      checks.seedData = {
        status: 'fail',
        message: 'No sites found - seed data may not be loaded',
      };
    }
  } catch (error) {
    checks.seedData = {
      status: 'fail',
      message: error instanceof Error ? error.message : 'Check failed',
    };
  }

  // Determine overall readiness
  const allPassed = Object.values(checks).every((c) => c.status === 'pass');

  const response = {
    ready: allPassed,
    timestamp: new Date().toISOString(),
    checks,
  };

  if (allPassed) {
    return NextResponse.json(response, { status: 200 });
  } else {
    return NextResponse.json(response, { status: 503 });
  }
}
