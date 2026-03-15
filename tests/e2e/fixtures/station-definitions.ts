import { FIXED_IDS } from './constants';

export interface StationFieldDefinition {
  key: string;
  type: 'number' | 'measurement' | 'select' | 'boolean' | 'text';
  validValue: string | number | boolean;
  invalidValue?: string | number | boolean;
}

export interface StationStepDefinition {
  id: string;
  name: string;
  fields: StationFieldDefinition[];
}

export interface StationQualityCheck {
  name: string;
  type: 'measurement' | 'pass_fail';
  validValue?: number;
}

export interface StationBomMaterial {
  code: string;
  qty: number;
}

export interface StationDefinition {
  id: string;
  name: string;
  steps: StationStepDefinition[];
  qualityChecks: StationQualityCheck[];
  bomMaterials: StationBomMaterial[];
}

export const WINDING_STATION: StationDefinition = {
  id: FIXED_IDS.stations.winding,
  name: 'Winding',
  steps: [
    {
      id: FIXED_IDS.steps.winding,
      name: 'Winding',
      fields: [
        { key: 'wire_gauge', type: 'select', validValue: '18AWG' },
        { key: 'turns_count', type: 'number', validValue: 100 },
        { key: 'resistance', type: 'measurement', validValue: 1.0 },
        { key: 'winding_direction', type: 'select', validValue: 'CW' },
      ],
    },
    {
      id: FIXED_IDS.steps.stator_lamination,
      name: 'Stator Lamination Stack Assembly',
      fields: [
        { key: 'stack_height', type: 'measurement', validValue: 25.0 },
        { key: 'press_force', type: 'measurement', validValue: 5.0 },
        { key: 'lamination_count', type: 'number', validValue: 50 },
      ],
    },
    {
      id: FIXED_IDS.steps.insulation,
      name: 'Insulation Application',
      fields: [
        { key: 'insulation_type', type: 'select', validValue: 'Nomex 410' },
        { key: 'coverage_check', type: 'boolean', validValue: true },
        { key: 'insulation_thickness', type: 'measurement', validValue: 0.20 },
      ],
    },
    {
      id: FIXED_IDS.steps.lead_wire,
      name: 'Lead Wire Termination',
      fields: [
        { key: 'crimp_force', type: 'measurement', validValue: 50 },
        { key: 'pull_test', type: 'measurement', validValue: 50 },
        { key: 'pull_test_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.varnish,
      name: 'Stator Varnish/Epoxy',
      fields: [
        { key: 'varnish_type', type: 'select', validValue: 'Polyester' },
        { key: 'cure_temp', type: 'measurement', validValue: 150 },
        { key: 'cure_time', type: 'measurement', validValue: 60 },
        { key: 'cure_complete', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.wire_cutting,
      name: 'Wire Cutting/Stripping',
      fields: [
        { key: 'wire_length', type: 'measurement', validValue: 150 },
        { key: 'strip_length', type: 'measurement', validValue: 6.0 },
        { key: 'wire_count', type: 'number', validValue: 3 },
      ],
    },
    {
      id: FIXED_IDS.steps.connector_crimping,
      name: 'Connector Crimping',
      fields: [
        { key: 'crimp_height', type: 'measurement', validValue: 2.0 },
        { key: 'pull_force', type: 'measurement', validValue: 50 },
        { key: 'crimp_pass', type: 'boolean', validValue: true },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Winding Resistance Check', type: 'measurement', validValue: 1.0 },
    { name: 'Visual Inspection', type: 'pass_fail' },
  ],
  bomMaterials: [{ code: 'WIRE-CU-18AWG', qty: 50 }],
};

export const MAGNET_INSTALL_STATION: StationDefinition = {
  id: FIXED_IDS.stations.magnet_install,
  name: 'Magnet Install',
  steps: [
    {
      id: FIXED_IDS.steps.magnet_bonding,
      name: 'Magnet Bonding',
      fields: [
        { key: 'adhesive_type', type: 'select', validValue: 'Loctite 638' },
        { key: 'cure_temp', type: 'measurement', validValue: 23 },
        { key: 'magnet_orientation', type: 'boolean', validValue: true },
        { key: 'magnet_count', type: 'number', validValue: 4 },
      ],
    },
    {
      id: FIXED_IDS.steps.rotor_balancing,
      name: 'Rotor Balancing',
      fields: [
        { key: 'imbalance_grams', type: 'measurement', validValue: 0.1 },
        { key: 'correction_method', type: 'select', validValue: 'None needed' },
        { key: 'balance_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.shaft_press,
      name: 'Shaft Press',
      fields: [
        { key: 'press_force', type: 'measurement', validValue: 3.0 },
        { key: 'runout', type: 'measurement', validValue: 0.01 },
        { key: 'press_pass', type: 'boolean', validValue: true },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Visual Inspection', type: 'pass_fail' },
  ],
  bomMaterials: [{ code: 'MAG-NEOD-10MM', qty: 4 }],
};

export const HOUSING_ASSEMBLY_STATION: StationDefinition = {
  id: FIXED_IDS.stations.housing_assembly,
  name: 'Housing Assembly',
  steps: [
    {
      id: FIXED_IDS.steps.bearing_press,
      name: 'Bearing Press',
      fields: [
        { key: 'press_force', type: 'measurement', validValue: 1.0 },
        { key: 'bearing_type', type: 'select', validValue: '608-2RS' },
        { key: 'bearing_seated', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.seal_installation,
      name: 'Seal Installation',
      fields: [
        { key: 'seal_type', type: 'select', validValue: 'NBR 42mm' },
        { key: 'orientation_check', type: 'boolean', validValue: true },
        { key: 'seal_seated', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.rotor_insertion,
      name: 'Rotor Insertion',
      fields: [
        { key: 'air_gap_clearance', type: 'measurement', validValue: 0.5 },
        { key: 'free_rotation', type: 'boolean', validValue: true },
        { key: 'no_rubbing', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.end_bell,
      name: 'End Bell Assembly',
      fields: [
        { key: 'torque_spec', type: 'measurement', validValue: 3.0 },
        { key: 'gasket_check', type: 'boolean', validValue: true },
        { key: 'all_fasteners_installed', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.wire_harness_routing,
      name: 'Wire Harness Routing',
      fields: [
        { key: 'routing_path', type: 'boolean', validValue: true },
        { key: 'strain_relief', type: 'boolean', validValue: true },
        { key: 'no_pinch_points', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.connector_mating,
      name: 'Connector Mating',
      fields: [
        { key: 'engagement_check', type: 'boolean', validValue: true },
        { key: 'locking_mechanism', type: 'boolean', validValue: true },
        { key: 'pull_test_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.cover_closure,
      name: 'Cover/Housing Closure',
      fields: [
        { key: 'torque_spec', type: 'measurement', validValue: 2.5 },
        { key: 'seal_verification', type: 'boolean', validValue: true },
        { key: 'all_fasteners', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.label_application,
      name: 'Label Application',
      fields: [
        { key: 'label_type', type: 'select', validValue: 'Product Label' },
        { key: 'placement_correct', type: 'boolean', validValue: true },
        { key: 'readability_check', type: 'boolean', validValue: true },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Visual Inspection', type: 'pass_fail' },
    { name: 'Housing Torque Check', type: 'measurement', validValue: 3.0 },
  ],
  bomMaterials: [
    { code: 'HOUS-ALU-M42', qty: 1 },
    { code: 'BEAR-608-2RS', qty: 2 },
    { code: 'SEAL-NBR-42', qty: 2 },
  ],
};

export const QUALITY_INSPECTION_STATION: StationDefinition = {
  id: FIXED_IDS.stations.quality_inspection,
  name: 'Quality Inspection',
  steps: [
    {
      id: FIXED_IDS.steps.stator_dimensional,
      name: 'Stator Dimensional Inspection',
      fields: [
        { key: 'outer_diameter', type: 'measurement', validValue: 42.0 },
        { key: 'inner_diameter', type: 'measurement', validValue: 25.0 },
        { key: 'stack_height', type: 'measurement', validValue: 25.0 },
      ],
    },
    {
      id: FIXED_IDS.steps.rotor_dimensional,
      name: 'Rotor Dimensional Inspection',
      fields: [
        { key: 'rotor_od', type: 'measurement', validValue: 24.5 },
        { key: 'shaft_runout', type: 'measurement', validValue: 0.01 },
        { key: 'inspection_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.base_dimensional,
      name: 'Base Dimensional Inspection',
      fields: [
        { key: 'bearing_bore', type: 'measurement', validValue: 22.0 },
        { key: 'mounting_hole_spacing', type: 'measurement', validValue: 50.0 },
        { key: 'inspection_pass', type: 'boolean', validValue: true },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Full Quality Inspection', type: 'pass_fail' },
  ],
  bomMaterials: [],
};

export const ELECTRICAL_TEST_STATION: StationDefinition = {
  id: FIXED_IDS.stations.electrical_test,
  name: 'Electrical Test',
  steps: [
    {
      id: FIXED_IDS.steps.stator_electrical,
      name: 'Stator Electrical Test',
      fields: [
        { key: 'hipot_voltage', type: 'measurement', validValue: 1500 },
        { key: 'hipot_pass', type: 'boolean', validValue: true },
        { key: 'surge_test_pass', type: 'boolean', validValue: true },
        { key: 'phase_resistance', type: 'measurement', validValue: 1.0 },
      ],
    },
    {
      id: FIXED_IDS.steps.harness_continuity,
      name: 'Harness Continuity Test',
      fields: [
        { key: 'conductor_a_resistance', type: 'measurement', validValue: 10 },
        { key: 'conductor_b_resistance', type: 'measurement', validValue: 10 },
        { key: 'conductor_c_resistance', type: 'measurement', validValue: 10 },
        { key: 'continuity_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.hipot_test,
      name: 'Hi-Pot Test',
      fields: [
        { key: 'test_voltage', type: 'measurement', validValue: 1500 },
        { key: 'leakage_current', type: 'measurement', validValue: 1.0 },
        { key: 'hipot_pass', type: 'boolean', validValue: true },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Electrical Test - Continuity', type: 'pass_fail' },
    { name: 'Electrical Test - Insulation', type: 'measurement', validValue: 500 },
  ],
  bomMaterials: [],
};

export const FINAL_TEST_STATION: StationDefinition = {
  id: FIXED_IDS.stations.final_test,
  name: 'Final Test',
  steps: [
    {
      id: FIXED_IDS.steps.functional_run,
      name: 'Functional Run Test',
      fields: [
        { key: 'rpm', type: 'measurement', validValue: 3000 },
        { key: 'current_draw', type: 'measurement', validValue: 2.0 },
        { key: 'vibration_level', type: 'measurement', validValue: 1.0 },
        { key: 'noise_level', type: 'measurement', validValue: 40 },
        { key: 'run_test_pass', type: 'boolean', validValue: true },
      ],
    },
    {
      id: FIXED_IDS.steps.final_inspection,
      name: 'Final Inspection',
      fields: [
        { key: 'cosmetic_check', type: 'boolean', validValue: true },
        { key: 'packaging_readiness', type: 'boolean', validValue: true },
        { key: 'documentation_complete', type: 'boolean', validValue: true },
        { key: 'final_disposition', type: 'select', validValue: 'Ship' },
      ],
    },
  ],
  qualityChecks: [
    { name: 'Final Test - RPM', type: 'measurement', validValue: 3000 },
    { name: 'Final Test - Current Draw', type: 'measurement', validValue: 2.0 },
  ],
  bomMaterials: [],
};

export const ALL_STATIONS: StationDefinition[] = [
  WINDING_STATION,
  MAGNET_INSTALL_STATION,
  HOUSING_ASSEMBLY_STATION,
  QUALITY_INSPECTION_STATION,
  ELECTRICAL_TEST_STATION,
  FINAL_TEST_STATION,
];
