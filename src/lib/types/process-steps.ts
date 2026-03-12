/**
 * Type definitions for process step data capture fields
 */

export type DataFieldType = 'number' | 'text' | 'boolean' | 'select';

export interface DataFieldDefinition {
  id: string;          // Unique field ID within the step
  name: string;        // Display name (e.g., "Press Force")
  type: DataFieldType;
  unit?: string;       // Unit of measure (e.g., "N", "C", "mm")
  required: boolean;
  min?: number;        // For number type: lower limit (fail if below)
  max?: number;        // For number type: upper limit (fail if above)
  options?: string[];  // For select type: dropdown options
  description?: string; // Help text for operator
}

/**
 * Assembly group categories for BLDC motor production
 */
export type AssemblyGroup =
  | 'stator'
  | 'rotor'
  | 'wire_harness'
  | 'base_housing'
  | 'final_assembly'
  | 'eol_testing';

export const ASSEMBLY_GROUP_LABELS: Record<AssemblyGroup, string> = {
  stator: 'Stator Production',
  rotor: 'Rotor Assembly',
  wire_harness: 'Wire Harness',
  base_housing: 'Base/Housing Assembly',
  final_assembly: 'Final Assembly',
  eol_testing: 'End-of-Line Testing',
};

export const ASSEMBLY_GROUP_ORDER: AssemblyGroup[] = [
  'stator',
  'rotor',
  'wire_harness',
  'base_housing',
  'final_assembly',
  'eol_testing',
];

export const STEP_CATEGORIES = [
  { value: 'stator_production', label: 'Stator Production' },
  { value: 'stator_electrical', label: 'Stator Electrical' },
  { value: 'wire_harness', label: 'Wire Harness' },
  { value: 'base_assembly', label: 'Base Assembly' },
  { value: 'rotor_assembly', label: 'Rotor Assembly' },
  { value: 'final_assembly', label: 'Final Assembly' },
  { value: 'packaging', label: 'Packaging' },
] as const;

export type StepCategory = typeof STEP_CATEGORIES[number]['value'];

export const DATA_FIELD_TYPES = [
  { value: 'number' as const, label: 'Number', description: 'Numeric measurement with optional limits' },
  { value: 'text' as const, label: 'Text', description: 'Free-form text input' },
  { value: 'boolean' as const, label: 'Checkbox', description: 'Yes/No confirmation' },
  { value: 'select' as const, label: 'Dropdown', description: 'Select from predefined options' },
];

/**
 * Validate captured data against field definitions.
 * Returns an object with { valid, errors, autoResult }.
 * autoResult is 'pass' if all number fields are within limits, 'fail' otherwise.
 */
export function validateCapturedData(
  fields: DataFieldDefinition[],
  data: Record<string, unknown>
): { valid: boolean; errors: Record<string, string>; autoResult: 'pass' | 'fail' } {
  const errors: Record<string, string> = {};
  let autoResult: 'pass' | 'fail' = 'pass';

  for (const field of fields) {
    const value = data[field.id];

    // Check required fields
    if (field.required) {
      if (value === undefined || value === null || value === '') {
        errors[field.id] = `${field.name} is required`;
        continue;
      }
    }

    // Skip validation if value is empty and not required
    if (value === undefined || value === null || value === '') {
      continue;
    }

    // Type-specific validation
    switch (field.type) {
      case 'number': {
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numValue)) {
          errors[field.id] = `${field.name} must be a valid number`;
          break;
        }
        if (field.min !== undefined && numValue < field.min) {
          autoResult = 'fail';
        }
        if (field.max !== undefined && numValue > field.max) {
          autoResult = 'fail';
        }
        break;
      }
      case 'select': {
        if (field.options && !field.options.includes(String(value))) {
          errors[field.id] = `${field.name}: invalid selection`;
        }
        break;
      }
      case 'boolean': {
        // Boolean fields are always valid (true/false)
        break;
      }
      case 'text': {
        // Text fields just need to be strings
        break;
      }
    }
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
    autoResult,
  };
}
