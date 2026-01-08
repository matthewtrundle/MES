export type LossType = 'equipment' | 'changeover' | 'material' | 'quality' | 'planned' | 'other';

export const LOSS_TYPES: { value: LossType; label: string; color: string }[] = [
  { value: 'equipment', label: 'Equipment', color: 'bg-red-500' },
  { value: 'changeover', label: 'Changeover', color: 'bg-amber-500' },
  { value: 'material', label: 'Material', color: 'bg-orange-500' },
  { value: 'quality', label: 'Quality', color: 'bg-purple-500' },
  { value: 'planned', label: 'Planned', color: 'bg-blue-500' },
  { value: 'other', label: 'Other', color: 'bg-slate-500' },
];
