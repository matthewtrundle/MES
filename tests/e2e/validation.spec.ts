import { test, expect } from '@playwright/test';
import { StationPage } from './page-objects/station.page';
import { CreateUnitDialog } from './page-objects/create-unit.dialog';
import { FIXED_IDS } from './fixtures/constants';
import { reseedDatabase } from './fixtures/seed';

const STATION_ID = FIXED_IDS.stations.winding;
const WORK_ORDER_ID = FIXED_IDS.workOrders.wo1;

test.describe('Validation', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('duplicate serial number shows error', async ({ page }) => {
    const stationPage = new StationPage(page);
    const createUnit = new CreateUnitDialog(page);
    const serial = `E2E-DUP-${Date.now()}`;

    await stationPage.goto(STATION_ID);

    // Create first unit
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });

    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Try to create second unit with same serial
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();

    // Should show an error
    await expect(createUnit.getError()).toBeVisible({ timeout: 10000 });
  });

  test('auto-generate serial when left blank', async ({ page }) => {
    const stationPage = new StationPage(page);
    const createUnit = new CreateUnitDialog(page);

    await stationPage.goto(STATION_ID);

    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    // Leave serial blank
    await createUnit.submit();

    // Dialog should close successfully (auto-generated serial)
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
  });
});
