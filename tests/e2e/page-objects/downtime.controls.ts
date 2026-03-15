import { Page } from '@playwright/test';

export class DowntimeControls {
  constructor(private page: Page) {}

  async start() {
    await this.page.getByTestId('downtime-start-btn').click();
  }

  async end() {
    await this.page.getByTestId('downtime-end-btn').click();
  }

  async selectReason(id: string) {
    await this.page.getByTestId(`downtime-reason-${id}`).click();
  }

  getPanel() {
    return this.page.getByTestId('downtime-panel');
  }

  getElapsed() {
    return this.page.getByTestId('downtime-elapsed');
  }

  getSelectedReason() {
    return this.page.getByTestId('downtime-selected-reason');
  }

  getStartBtn() {
    return this.page.getByTestId('downtime-start-btn');
  }

  getEndBtn() {
    return this.page.getByTestId('downtime-end-btn');
  }

  async isActive() {
    return this.page.getByTestId('downtime-panel').isVisible();
  }
}
