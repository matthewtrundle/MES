import { Page } from '@playwright/test';
import { WorkOrderPanel } from './work-order.panel';
import { ActiveUnitPanel } from './active-unit.panel';
import { StepDataPanel } from './step-data.panel';
import { DowntimeControls } from './downtime.controls';

export class StationPage {
  readonly workOrders: WorkOrderPanel;
  readonly activeUnit: ActiveUnitPanel;
  readonly stepData: StepDataPanel;
  readonly downtime: DowntimeControls;

  constructor(private page: Page) {
    this.workOrders = new WorkOrderPanel(page);
    this.activeUnit = new ActiveUnitPanel(page);
    this.stepData = new StepDataPanel(page);
    this.downtime = new DowntimeControls(page);
  }

  async goto(stationId: string) {
    await this.page.goto(`/station/${stationId}`);
    await this.waitForLoaded();
  }

  async waitForLoaded() {
    await this.page.waitForSelector('[data-testid="station-page"]');
    await this.page.waitForSelector('[data-testid="station-header"]');
  }

  getHeaderName() {
    return this.page.getByTestId('station-header-name');
  }

  getHeaderStatus() {
    return this.page.getByTestId('station-header-status');
  }

  getHeaderActiveUnits() {
    return this.page.getByTestId('station-header-active-units');
  }

  getNoActiveUnits() {
    return this.page.getByTestId('station-no-active-units');
  }

  getChangeStationBtn() {
    return this.page.getByTestId('station-change-btn');
  }
}
