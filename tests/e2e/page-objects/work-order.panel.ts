import { Page } from '@playwright/test';

export class WorkOrderPanel {
  constructor(private page: Page) {}

  getList() {
    return this.page.getByTestId('work-order-list');
  }

  getEmpty() {
    return this.page.getByTestId('work-order-list-empty');
  }

  getWorkOrder(id: string) {
    return this.page.getByTestId(`work-order-${id}`);
  }

  getCompletedCount(id: string) {
    return this.page.getByTestId(`work-order-completed-${id}`);
  }

  async selectWorkOrder(id: string) {
    await this.page.getByTestId(`work-order-${id}`).click();
  }

  async clickStartUnit(id: string) {
    await this.page.getByTestId(`work-order-start-unit-${id}`).click();
  }
}
