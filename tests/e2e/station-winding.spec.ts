import { test, expect } from '@playwright/test';
import { StationPage } from './page-objects/station.page';
import { StationSelectionPage } from './page-objects/station-selection.page';
import { CreateUnitDialog } from './page-objects/create-unit.dialog';
import { MaterialDialog } from './page-objects/material.dialog';
import { QualityDialog } from './page-objects/quality.dialog';
import { StepDataPanel } from './page-objects/step-data.panel';
import { FIXED_IDS } from './fixtures/constants';
import { WINDING_STATION } from './fixtures/station-definitions';
import { reseedDatabase } from './fixtures/seed';

const STATION_ID = FIXED_IDS.stations.winding;
const WORK_ORDER_ID = FIXED_IDS.workOrders.wo1;
const TEST_SERIAL = `E2E-WIND-${Date.now()}`;

test.describe('Winding Station', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  let stationPage: StationPage;

  test.beforeEach(async ({ page }) => {
    stationPage = new StationPage(page);
  });

  test('page loads and shows station header', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    await expect(stationPage.getHeaderName()).toHaveText('Winding');
  });

  test('work order WO-2026-001 is visible', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const woCard = stationPage.workOrders.getWorkOrder(WORK_ORDER_ID);
    await expect(woCard).toBeVisible();
  });

  test('can navigate from station selection', async ({ page }) => {
    const selectionPage = new StationSelectionPage(page);
    await selectionPage.goto();
    const card = selectionPage.getStationCardName(STATION_ID);
    await expect(card).toHaveText('Winding');
    await selectionPage.selectStation(STATION_ID);
    await expect(stationPage.getHeaderName()).toHaveText('Winding');
  });

  test('create unit from work order', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const createUnit = new CreateUnitDialog(page);

    // Select work order
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);

    // Click Start New Unit
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);

    // Fill serial and submit
    await createUnit.waitForOpen();
    await createUnit.enterSerial(TEST_SERIAL);
    await createUnit.submit();

    // Wait for dialog to close and page to refresh
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify no active units message is gone
    await expect(stationPage.getNoActiveUnits()).not.toBeVisible();
  });

  test('fill all step data for winding station', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const createUnit = new CreateUnitDialog(page);
    const serial = `E2E-STEPS-${Date.now()}`;

    // Create a unit first
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Scope step data to the last active unit card (the one we just created)
    // Use a regex to match only the top-level active-unit-{uuid} testid, not nested elements
    const activeUnits = page.locator('[data-testid^="active-unit-"]').filter({ has: page.getByTestId('step-data-panel') });
    const lastUnit = activeUnits.last();
    const scopedStepData = new StepDataPanel(page, lastUnit);

    // Fill all step data
    for (const step of WINDING_STATION.steps) {
      await scopedStepData.expandStep(step.id);
      await page.waitForTimeout(300);

      for (const field of step.fields) {
        await scopedStepData.fillField(step.id, field.key, field.validValue, field.type);
      }

      await scopedStepData.save(step.id);
      await page.waitForTimeout(1000);
    }

    // Verify progress shows captures
    const progress = scopedStepData.getProgress();
    await expect(progress).toBeVisible();
  });

  test('record material consumption', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const createUnit = new CreateUnitDialog(page);
    const materialDialog = new MaterialDialog(page);
    const serial = `E2E-MAT-${Date.now()}`;

    // Create a unit first
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Click Record Material
    const materialBtns = page.locator('[data-testid^="active-unit-material-btn-"]');
    await materialBtns.first().click();
    await materialDialog.waitForOpen();

    // Select BOM item WIRE-CU-18AWG
    await materialDialog.selectBomItem('WIRE-CU-18AWG');

    // Select first available lot
    const lots = page.locator('[data-testid^="material-lot-"]');
    await expect(lots.first()).toBeVisible({ timeout: 5000 });
    await lots.first().click();

    // Enter quantity and submit
    await materialDialog.enterQty(50);
    await materialDialog.submit();

    // Dialog should close
    await expect(materialDialog.getDialog()).not.toBeVisible({ timeout: 10000 });
  });

  test('perform quality check', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const createUnit = new CreateUnitDialog(page);
    const qualityDialog = new QualityDialog(page);
    const serial = `E2E-QC-${Date.now()}`;

    // Create a unit first
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Click Quality Check
    const qualityBtns = page.locator('[data-testid^="active-unit-quality-btn-"]');
    await qualityBtns.first().click();
    await qualityDialog.waitForOpen();

    // Select Winding Resistance Check (measurement type)
    const checkButtons = page.locator('[data-testid^="quality-check-"]');
    const count = await checkButtons.count();
    for (let i = 0; i < count; i++) {
      const text = await checkButtons.nth(i).textContent();
      if (text?.includes('Winding Resistance Check')) {
        await checkButtons.nth(i).click();
        break;
      }
    }

    // Enter measurement value and pass
    await qualityDialog.enterMeasurement(1.0);
    await qualityDialog.clickPass();

    // Dialog should close
    await expect(qualityDialog.getDialog()).not.toBeVisible({ timeout: 10000 });
  });

  test('complete operation with PASS', async ({ page }) => {
    await stationPage.goto(STATION_ID);
    const createUnit = new CreateUnitDialog(page);
    const serial = `E2E-PASS-${Date.now()}`;

    // Create a unit first
    await stationPage.workOrders.selectWorkOrder(WORK_ORDER_ID);
    await stationPage.workOrders.clickStartUnit(WORK_ORDER_ID);
    await createUnit.waitForOpen();
    await createUnit.enterSerial(serial);
    await createUnit.submit();
    await expect(createUnit.getDialog()).not.toBeVisible({ timeout: 10000 });
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Click PASS
    const passBtns = page.locator('[data-testid^="active-unit-pass-btn-"]');
    await passBtns.first().click();

    // Wait for the page to update — unit should disappear or state change
    await page.waitForTimeout(2000);
    await page.reload();
    await stationPage.waitForLoaded();
  });

  test('downtime flow — start, select reason, end', async ({ page }) => {
    await stationPage.goto(STATION_ID);

    // Start downtime
    await stationPage.downtime.start();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify downtime panel is visible
    await expect(stationPage.downtime.getPanel()).toBeVisible();

    // Verify elapsed time is shown
    await expect(stationPage.downtime.getElapsed()).toBeVisible();

    // Select a reason (click first available)
    const reasonBtns = page.locator('[data-testid^="downtime-reason-"]');
    await expect(reasonBtns.first()).toBeVisible();
    await reasonBtns.first().click();
    await page.waitForTimeout(1000);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify reason is shown
    await expect(stationPage.downtime.getSelectedReason()).toBeVisible();

    // End downtime
    await stationPage.downtime.end();
    await page.waitForTimeout(1500);
    await page.reload();
    await stationPage.waitForLoaded();

    // Verify downtime panel is gone
    await expect(stationPage.downtime.getPanel()).not.toBeVisible();
  });
});
