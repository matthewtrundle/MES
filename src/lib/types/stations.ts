export type StationType = 'winding' | 'assembly' | 'test' | 'inspection';

export const STATION_TYPES: { value: StationType; label: string; icon: string }[] = [
  { value: 'winding', label: 'Winding', icon: '🔄' },
  { value: 'assembly', label: 'Assembly', icon: '🔧' },
  { value: 'test', label: 'Test', icon: '📊' },
  { value: 'inspection', label: 'Inspection', icon: '🔍' },
];
