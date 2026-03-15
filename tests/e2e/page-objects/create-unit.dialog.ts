import { Page } from '@playwright/test';

export class CreateUnitDialog {
  constructor(private page: Page) {}

  async waitForOpen() {
    await this.page.waitForSelector('[data-testid="create-unit-dialog"]');
  }

  async enterSerial(serial: string) {
    await this.page.getByTestId('create-unit-serial-input').fill(serial);
  }

  async submit() {
    await this.page.getByTestId('create-unit-submit').click();
  }

  async cancel() {
    await this.page.getByTestId('create-unit-cancel').click();
  }

  getError() {
    return this.page.getByTestId('create-unit-error');
  }

  getDialog() {
    return this.page.getByTestId('create-unit-dialog');
  }
}
