import { Page, expect } from '@playwright/test';
import { StationPage } from '../page-objects/station.page';
import { CreateUnitDialog } from '../page-objects/create-unit.dialog';
import { MaterialDialog } from '../page-objects/material.dialog';
import { QualityDialog } from '../page-objects/quality.dialog';
import { StepDataPanel } from '../page-objects/step-data.panel';
import { StationDefinition } from '../fixtures/station-definitions';

export async function runStationHappyPath(
  page: Page,
  stationDef: StationDefinition,
  workOrderId: string,
  serial: string,
) {
  const stationPage = new StationPage(page);
  const createUnit = new CreateUnitDialog(page);
  const materialDialog = new MaterialDialog(page);
  const qualityDialog = new QualityDialog(page);

  // Navigate to station
  await stationPage.goto(stationDef.id);
  await expect(stationPage.getHeaderName()).toHaveText(stationDef.name);

  // Select work order and create unit
  await stationPage.workOrders.selectWorkOrder(workOrderId);
  await stationPage.workOrders.clickStartUnit(workOrderId);
  await createUnit.waitForOpen();
  await createUnit.enterSerial(serial);
  await createUnit.submit();

  // Wait for the page to refresh and show the active unit
  await page.waitForTimeout(2000);
  await page.reload();
  await stationPage.waitForLoaded();

  // Fill all step data — scope to the last active unit to avoid strict mode violations
  if (stationDef.steps.length > 0) {
    const activeUnits = page.locator('[data-testid^="active-unit-"]').filter({ has: page.getByTestId('step-data-panel') });
    const lastUnit = activeUnits.last();
    const scopedStepData = new StepDataPanel(page, lastUnit);

    for (const step of stationDef.steps) {
      await scopedStepData.expandStep(step.id);
      await page.waitForTimeout(300);

      for (const field of step.fields) {
        await scopedStepData.fillField(step.id, field.key, field.validValue, field.type);
      }

      await scopedStepData.save(step.id);
      await page.waitForTimeout(1000);
    }
  }

  // Record materials — only attempt if there are BOM materials defined
  if (stationDef.bomMaterials.length > 0) {
    const materialBtns = page.locator('[data-testid^="active-unit-material-btn-"]');
    if (await materialBtns.count() > 0) {
      await materialBtns.last().scrollIntoViewIfNeeded();
      await materialBtns.last().click({ force: true });
      await materialDialog.waitForOpen();

      // Try each BOM material, skip if no stock or button disabled
      for (const mat of stationDef.bomMaterials) {
        const bomItem = page.getByTestId(`material-bom-item-${mat.code}`);
        if (await bomItem.count() === 0) continue;

        const selectBtn = bomItem.locator('button:not([disabled])');
        if (await selectBtn.count() === 0) continue;

        const btnText = await selectBtn.textContent();
        if (btnText?.includes('No Stock')) continue;

        await selectBtn.click();
        await page.waitForTimeout(500);

        // Select the first available lot
        const lots = page.locator('[data-testid^="material-lot-"]');
        if (await lots.count() > 0) {
          await lots.first().click();
          await materialDialog.enterQty(mat.qty);
          await materialDialog.submit();
          await page.waitForTimeout(1000);

          // Re-open dialog for next material if there are more
          break; // Record one material per dialog open for simplicity
        }
      }

      // Close dialog if still open
      const dialog = materialDialog.getDialog();
      if (await dialog.isVisible()) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);
      }
    }
  }

  // Reload page to reset scroll and UI state before quality checks
  if (stationDef.qualityChecks.length > 0) {
    await page.reload();
    await stationPage.waitForLoaded();
  }

  // Perform quality checks
  for (const qc of stationDef.qualityChecks) {
    const qualityBtns = page.locator('[data-testid^="active-unit-quality-btn-"]');
    if (await qualityBtns.count() > 0) {
      // Scroll quality button well into view (past any sticky bars)
      await qualityBtns.last().evaluate(el => el.scrollIntoView({ block: 'center' }));
      await page.waitForTimeout(500);
      await qualityBtns.last().click();
      await qualityDialog.waitForOpen();
      // Select the quality check by name
      const checkButtons = page.locator('[data-testid^="quality-check-"]');
      const count = await checkButtons.count();
      for (let i = 0; i < count; i++) {
        const text = await checkButtons.nth(i).textContent();
        if (text?.includes(qc.name)) {
          await checkButtons.nth(i).click();
          break;
        }
      }
      if (qc.type === 'measurement' && qc.validValue !== undefined) {
        await qualityDialog.enterMeasurement(qc.validValue);
      }
      await qualityDialog.clickPass();
      await page.waitForTimeout(1000);
    }
  }

  // Complete the operation (PASS)
  const passBtns = page.locator('[data-testid^="active-unit-pass-btn-"]');
  if (await passBtns.count() > 0) {
    await passBtns.last().scrollIntoViewIfNeeded();
    await passBtns.last().click({ force: true });
    await page.waitForTimeout(2000);
  }
}
