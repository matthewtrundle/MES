import { Page, Locator } from '@playwright/test';

export class StepDataPanel {
  private scope: Locator;

  constructor(private page: Page, unitScope?: Locator) {
    // If a unit scope is provided, search within that unit's container
    // Otherwise search the full page (works when there's only one unit)
    this.scope = unitScope ?? page.locator('body');
  }

  getPanel() {
    return this.scope.getByTestId('step-data-panel');
  }

  getProgress() {
    return this.scope.getByTestId('step-data-progress');
  }

  getStepRow(id: string) {
    return this.scope.getByTestId(`step-row-${id}`);
  }

  async expandStep(id: string) {
    await this.scope.getByTestId(`step-header-${id}`).click();
  }

  getStepStatus(id: string) {
    return this.scope.getByTestId(`step-status-${id}`);
  }

  getRequiredBadge(id: string) {
    return this.scope.getByTestId(`step-required-badge-${id}`);
  }

  getField(stepId: string, fieldId: string) {
    return this.scope.getByTestId(`step-field-${stepId}-${fieldId}`);
  }

  getFieldStatus(stepId: string, fieldId: string) {
    return this.scope.getByTestId(`step-field-status-${stepId}-${fieldId}`);
  }

  async fillField(stepId: string, fieldId: string, value: string | number | boolean, type: 'number' | 'measurement' | 'select' | 'boolean' | 'text') {
    const fieldLocator = this.scope.getByTestId(`step-field-${stepId}-${fieldId}`);

    switch (type) {
      case 'number':
      case 'measurement':
        await fieldLocator.locator('input[type="number"]').fill(String(value));
        break;
      case 'text':
        await fieldLocator.locator('input').fill(String(value));
        break;
      case 'boolean':
        const checkbox = fieldLocator.locator('button[role="checkbox"]');
        const isChecked = await checkbox.getAttribute('data-state');
        if ((value && isChecked !== 'checked') || (!value && isChecked === 'checked')) {
          await checkbox.click();
        }
        break;
      case 'select':
        await fieldLocator.locator('button[role="combobox"]').click();
        await this.page.getByRole('option', { name: String(value), exact: true }).click();
        break;
    }
  }

  async save(id: string) {
    await this.scope.getByTestId(`step-save-${id}`).click();
  }

  async signOff(id: string) {
    await this.scope.getByTestId(`step-signoff-${id}`).click();
  }
}
