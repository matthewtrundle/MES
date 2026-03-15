import { Page } from '@playwright/test';

export class ActiveUnitPanel {
  constructor(private page: Page) {}

  getUnit(id: string) {
    return this.page.getByTestId(`active-unit-${id}`);
  }

  getSerial(id: string) {
    return this.page.getByTestId(`active-unit-serial-${id}`);
  }

  getStatus(id: string) {
    return this.page.getByTestId(`active-unit-status-${id}`);
  }

  getElapsed(id: string) {
    return this.page.getByTestId(`active-unit-elapsed-${id}`);
  }

  async clickPass(id: string) {
    await this.page.getByTestId(`active-unit-pass-btn-${id}`).click();
  }

  async clickFail(id: string) {
    await this.page.getByTestId(`active-unit-fail-btn-${id}`).click();
  }

  async clickMaterial(id: string) {
    await this.page.getByTestId(`active-unit-material-btn-${id}`).click();
  }

  async clickQuality(id: string) {
    await this.page.getByTestId(`active-unit-quality-btn-${id}`).click();
  }

  async waitForUnit() {
    await this.page.waitForSelector('[data-testid^="active-unit-"]');
  }
}
