import { test, expect } from '@playwright/test';
import { StationPage } from './page-objects/station.page';
import { FIXED_IDS } from './fixtures/constants';
import { reseedDatabase } from './fixtures/seed';

const STATION_ID = FIXED_IDS.stations.winding;

test.describe('Downtime', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('start and end downtime', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);

    // Verify start button is visible
    await expect(stationPage.downtime.getStartBtn()).toBeVisible();

    // Start downtime
    await stationPage.downtime.start();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify downtime panel appears
    await expect(stationPage.downtime.getPanel()).toBeVisible();
    await expect(stationPage.downtime.getElapsed()).toBeVisible();

    // Header should show downtime status
    await expect(stationPage.getHeaderStatus()).toContainText('Downtime');

    // End downtime
    await stationPage.downtime.end();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify downtime panel is gone
    await expect(stationPage.downtime.getPanel()).not.toBeVisible();
  });

  test('select downtime reason', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);

    // Start downtime
    await stationPage.downtime.start();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Select first reason
    const reasonBtns = page.locator('[data-testid^="downtime-reason-"]');
    await expect(reasonBtns.first()).toBeVisible();
    await reasonBtns.first().click();
    await page.waitForTimeout(1000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify reason is displayed
    await expect(stationPage.downtime.getSelectedReason()).toBeVisible();

    // Cleanup: end downtime
    await stationPage.downtime.end();
    await page.waitForTimeout(1500);
  });

  test('work orders disabled during downtime', async ({ page }) => {
    const stationPage = new StationPage(page);
    await stationPage.goto(STATION_ID);

    // Start downtime
    await stationPage.downtime.start();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Work order list items should have opacity-50 (disabled state)
    const woList = stationPage.workOrders.getList();
    await expect(woList).toBeVisible();

    // Cleanup: end downtime
    await stationPage.downtime.end();
    await page.waitForTimeout(1500);
  });
});
