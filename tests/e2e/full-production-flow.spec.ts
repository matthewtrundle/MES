import { test, expect } from '@playwright/test';
import { FIXED_IDS } from './fixtures/constants';
import { ALL_STATIONS } from './fixtures/station-definitions';
import { runStationHappyPath } from './utils/station-runner';
import { reseedDatabase } from './fixtures/seed';

const WORK_ORDER_ID = FIXED_IDS.workOrders.wo1;

test.describe('Full Production Flow', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('process unit through all 6 stations', async ({ page }) => {
    test.setTimeout(300_000); // 5 minutes for full flow

    for (const station of ALL_STATIONS) {
      const serial = `E2E-FULL-${station.name.replace(/\s+/g, '-').toUpperCase()}-${Date.now()}`;
      await runStationHappyPath(page, station, WORK_ORDER_ID, serial);
    }
  });
});
