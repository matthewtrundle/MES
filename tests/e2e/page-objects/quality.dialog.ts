import { Page } from '@playwright/test';

export class QualityDialog {
  constructor(private page: Page) {}

  getDialog() {
    return this.page.getByTestId('quality-dialog');
  }

  async waitForOpen() {
    await this.page.waitForSelector('[data-testid="quality-dialog"]');
  }

  async selectCheck(id: string) {
    await this.page.getByTestId(`quality-check-${id}`).click();
  }

  async enterMeasurement(value: number) {
    await this.page.getByTestId('quality-measurement-input').fill(String(value));
  }

  async clickPass() {
    await this.page.getByTestId('quality-pass-btn').click();
  }

  async clickFail() {
    await this.page.getByTestId('quality-fail-btn').click();
  }

  getError() {
    return this.page.getByTestId('quality-error');
  }
}
