import { Page } from '@playwright/test';

export class MaterialDialog {
  constructor(private page: Page) {}

  getDialog() {
    return this.page.getByTestId('material-dialog');
  }

  async waitForOpen() {
    await this.page.waitForSelector('[data-testid="material-dialog"]');
  }

  getBomItem(code: string) {
    return this.page.getByTestId(`material-bom-item-${code}`);
  }

  async selectBomItem(code: string) {
    await this.page.getByTestId(`material-bom-item-${code}`).locator('button').click();
  }

  getLot(id: string) {
    return this.page.getByTestId(`material-lot-${id}`);
  }

  async selectLot(id: string) {
    await this.page.getByTestId(`material-lot-${id}`).click();
  }

  async enterQty(qty: number) {
    await this.page.getByTestId('material-quantity-input').fill(String(qty));
  }

  async submit() {
    await this.page.getByTestId('material-submit-btn').click();
  }

  getError() {
    return this.page.getByTestId('material-error');
  }
}
