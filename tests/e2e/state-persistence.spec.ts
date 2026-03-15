import { test, expect } from '@playwright/test';
import { StationPage } from './page-objects/station.page';
import { CreateUnitDialog } from './page-objects/create-unit.dialog';
import { FIXED_IDS } from './fixtures/constants';
import { reseedDatabase } from './fixtures/seed';

const STATION_ID = FIXED_IDS.stations.winding;
const WORK_ORDER_ID = FIXED_IDS.workOrders.wo1;

test.describe('State Persistence', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('active unit persists after page refresh', async ({ page }) => {
    const stationPage = new StationPage(page);
    const createUnit = new CreateUnitDialog(page);
    const serial = `E2E-PERSIST-${Date.now()}`;

    await stationPage.goto(STATION_ID);

    // Create a unit
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);

    // Refresh and verify unit is still there
    await page.reload();
    await stationPage.waitForLoaded();
    await expect(stationPage.getNoActiveUnits()).not.toBeVisible();

    // Verify serial is visible
    const serialEl = page.locator(`text=${serial}`);
    await expect(serialEl).toBeVisible();
  });

  test('downtime state persists after refresh', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);

    // Start downtime
    await stationPage.downtime.start();
    await page.waitForTimeout(1500);

    // Refresh
    await page.reload();
    await stationPage.waitForLoaded();

    // Downtime panel should still be visible
    await expect(stationPage.downtime.getPanel()).toBeVisible();

    // Cleanup
    await stationPage.downtime.end();
    await page.waitForTimeout(1500);
  });

  test('work order list loads consistently', async ({ page }) => {
    const stationPage = new StationPage(page);

    await stationPage.goto(STATION_ID);
    await expect(stationPage.workOrders.getList()).toBeVisible();

    // Navigate away and back
    await stationPage.getChangeStationBtn().click();
    await page.waitForSelector('[data-testid="station-selection-page"]');

    await page.goto(`/station/${STATION_ID}`);
    await stationPage.waitForLoaded();
    await expect(stationPage.workOrders.getList()).toBeVisible();
  });
});
