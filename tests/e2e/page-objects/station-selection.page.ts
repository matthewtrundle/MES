import { Page } from '@playwright/test';

export class StationSelectionPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto('/station');
    await this.page.waitForSelector('[data-testid="station-selection-page"]');
  }

  async selectStation(id: string) {
    await this.page.getByTestId(`station-card-${id}`).click();
    await this.page.waitForSelector('[data-testid="station-page"]');
  }

  getStationCard(id: string) {
    return this.page.getByTestId(`station-card-${id}`);
  }

  getStationCardName(id: string) {
    return this.page.getByTestId(`station-card-name-${id}`);
  }

  getStationCardLocator() {
    // Match elements whose data-testid starts with "station-card-" but does NOT contain "-name-"
    return this.page.locator('[data-testid^="station-card-"]:not([data-testid*="-name-"])');
  }

  async getStationCards() {
    return this.getStationCardLocator().all();
  }
}
