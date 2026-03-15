import { test, expect } from '@playwright/test';
import { StationSelectionPage } from './page-objects/station-selection.page';
import { StationPage } from './page-objects/station.page';
import { FIXED_IDS } from './fixtures/constants';
import { reseedDatabase } from './fixtures/seed';

test.describe('Navigation', () => {
  test.beforeAll(() => {
    reseedDatabase();
  });

  test('station selection page shows all 6 stations', async ({ page }) => {
    const selectionPage = new StationSelectionPage(page);
    await selectionPage.goto();
    const cards = await selectionPage.getStationCards();
    expect(cards.length).toBe(6);
  });

  test('can navigate to winding station', async ({ page }) => {
    const selectionPage = new StationSelectionPage(page);
    const stationPage = new StationPage(page);

    await selectionPage.goto();
    await selectionPage.selectStation(FIXED_IDS.stations.winding);
    await expect(stationPage.getHeaderName()).toHaveText('Winding');
  });

  test('can navigate to each station', async ({ page }) => {
    const selectionPage = new StationSelectionPage(page);
    const stationPage = new StationPage(page);

    const stationsToTest = [
      { id: FIXED_IDS.stations.winding, name: 'Winding' },
      { id: FIXED_IDS.stations.magnet_install, name: 'Magnet Install' },
      { id: FIXED_IDS.stations.housing_assembly, name: 'Housing Assembly' },
      { id: FIXED_IDS.stations.quality_inspection, name: 'Quality Inspection' },
      { id: FIXED_IDS.stations.electrical_test, name: 'Electrical Test' },
      { id: FIXED_IDS.stations.final_test, name: 'Final Test' },
    ];

    for (const station of stationsToTest) {
      await selectionPage.goto();
      await selectionPage.selectStation(station.id);
      await expect(stationPage.getHeaderName()).toHaveText(station.name);
    }
  });

  test('change station button navigates back to selection', async ({ page }) => {
    const stationPage = new StationPage(page);

    await stationPage.goto(FIXED_IDS.stations.winding);
    await stationPage.getChangeStationBtn().click();

    await page.waitForSelector('[data-testid="station-selection-page"]');
  });

  test('direct URL navigation to station works', async ({ page }) => {
    const stationPage = new StationPage(page);

    await stationPage.goto(FIXED_IDS.stations.final_test);
    await expect(stationPage.getHeaderName()).toHaveText('Final Test');
  });
});
