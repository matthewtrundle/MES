import { test, expect } from '@playwright/test';
import { StationPage } from './page-objects/station.page';
import { FIXED_IDS } from './fixtures/constants';
import { FINAL_TEST_STATION } from './fixtures/station-definitions';
import { runStationHappyPath } from './utils/station-runner';
import { reseedDatabase } from './fixtures/seed';

const STATION_ID = FIXED_IDS.stations.final_test;
const WORK_ORDER_ID = FIXED_IDS.workOrders.wo1;

test.describe('Final Test Station', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('page loads and shows station header', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);
    await expect(stationPage.getHeaderName()).toHaveText('Final Test');
  });

  test('work order is visible', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);
    await expect(stationPage.workOrders.getWorkOrder(WORK_ORDER_ID)).toBeVisible();
  });

  test('happy path — full workflow', async ({ page }) => {
    test.setTimeout(120_000);
    const serial = `E2E-FINAL-${Date.now()}`;
    await runStationHappyPath(page, FINAL_TEST_STATION, WORK_ORDER_ID, serial);
  });
});
