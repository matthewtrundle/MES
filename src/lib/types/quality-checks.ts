export type CheckType = 'pass_fail' | 'measurement' | 'checklist';

export const CHECK_TYPES: { value: CheckType; label: string; icon: string; description: string }[] = [
  { value: 'pass_fail', label: 'Pass/Fail', icon: '✓', description: 'Simple pass or fail check' },
  { value: 'measurement', label: 'Measurement', icon: '📏', description: 'Numeric value within limits' },
  { value: 'checklist', label: 'Checklist', icon: '☑️', description: 'Multiple items to verify' },
];

export type MeasurementParameters = {
  min?: number;
  max?: number;
  unit: string;
  target?: number;
};

export type ChecklistParameters = {
  items: string[];
  requireAll: boolean;
};

export type PassFailParameters = {
  requireNotes: boolean;
};
