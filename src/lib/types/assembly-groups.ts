// Assembly group constants (shared between server actions and UI components)

export const ASSEMBLY_GROUPS = [
  'stator',
  'rotor',
  'wire_harness',
  'base',
  'final_assembly',
] as const;

export type AssemblyGroup = (typeof ASSEMBLY_GROUPS)[number];

export const ASSEMBLY_GROUP_LABELS: Record<string, string> = {
  stator: 'Stator',
  rotor: 'Rotor',
  wire_harness: 'Wire Harness',
  base: 'Base',
  final_assembly: 'Final Assembly',
};
