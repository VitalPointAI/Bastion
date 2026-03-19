/**
 * JP 5-0 / JP 3-33 Doctrinal RACI Defaults
 *
 * Phase 53 Plan 02: Doctrinal defaults for RACI matrix per military echelon.
 *
 * Strategic echelon uses J-codes (j2, j3, j4, j5, j6).
 * Tactical echelon uses S-codes (s2, s3, s4, s5, s6).
 * Operational echelon uses J-codes (joint task force level).
 *
 * Key JP 5-0 doctrine:
 *   - Commander: R/A on mission approval, ROE, force allocation, order release
 *   - XO: R on staff coordination, A on internal ops
 *   - J2/S2: R on intel assessment, threat analysis
 *   - J3/S3: R on COA development, scheme of maneuver, fires allocation
 *   - J4/S4: R on sustainment plan, logistics support, force projection
 *   - J5/S5: R on campaign plan, phase transition, strategic design
 *   - J6/S6: R on C4ISR architecture, network change
 */

import type { Echelon, RACIDefault } from './decision-types.js';
import { DECISION_TYPES } from './decision-types.js';

// ---------------------------------------------------------------------------
// Strategic Echelon Defaults (J-codes — joint/combatant command level)
// ---------------------------------------------------------------------------

export const STRATEGIC_RACI_DEFAULTS: RACIDefault[] = [
  // Mission approval — Commander is R and A
  { decision_type: DECISION_TYPES.mission_approval, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'j5', raci_role: 'C' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'j3', raci_role: 'I' },

  // ROE change — Commander R/A, legal consulted
  { decision_type: DECISION_TYPES.roe_change, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j5', raci_role: 'C' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j2', raci_role: 'I' },

  // Force allocation — Commander decides, J3 responsible, J4 consulted
  { decision_type: DECISION_TYPES.force_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j4', raci_role: 'C' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j5', raci_role: 'C' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j2', raci_role: 'I' },

  // Staff coordination — XO responsible, Commander informed
  { decision_type: DECISION_TYPES.staff_coordination, position: 'xo', raci_role: 'R' },
  { decision_type: DECISION_TYPES.staff_coordination, position: 'commander', raci_role: 'I' },

  // Internal ops — XO accountable
  { decision_type: DECISION_TYPES.internal_ops, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.internal_ops, position: 'commander', raci_role: 'I' },

  // Intel assessment — J2 responsible
  { decision_type: DECISION_TYPES.intel_assessment, position: 'j2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'j5', raci_role: 'I' },

  // Threat analysis — J2 responsible
  { decision_type: DECISION_TYPES.threat_analysis, position: 'j2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 'j3', raci_role: 'C' },

  // COA development — J3 responsible, J2/J5 consulted
  { decision_type: DECISION_TYPES.coa_development, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.coa_development, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j4', raci_role: 'C' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j5', raci_role: 'C' },

  // Scheme of maneuver — J3 responsible
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j4', raci_role: 'C' },

  // Fires allocation — J3 responsible
  { decision_type: DECISION_TYPES.fires_allocation, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 'j2', raci_role: 'C' },

  // Sustainment plan — J4 responsible
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'j5', raci_role: 'I' },

  // Logistics support — J4 responsible
  { decision_type: DECISION_TYPES.logistics_support, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.logistics_support, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.logistics_support, position: 'j3', raci_role: 'C' },

  // Force projection — J4 responsible
  { decision_type: DECISION_TYPES.force_projection, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_projection, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_projection, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.force_projection, position: 'j5', raci_role: 'C' },

  // Campaign plan — J5 responsible
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j4', raci_role: 'C' },

  // Phase transition — J5 responsible
  { decision_type: DECISION_TYPES.phase_transition, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'j2', raci_role: 'I' },

  // Strategic design — J5 responsible
  { decision_type: DECISION_TYPES.strategic_design, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'j3', raci_role: 'C' },

  // C4ISR architecture — J6 responsible
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'j6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'j3', raci_role: 'C' },

  // Network change — J6 responsible
  { decision_type: DECISION_TYPES.network_change, position: 'j6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.network_change, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.network_change, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.network_change, position: 'commander', raci_role: 'I' },

  // Order release — Commander responsible and accountable
  { decision_type: DECISION_TYPES.order_release, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.order_release, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.order_release, position: 'j3', raci_role: 'C' },

  // Design revision — J5 responsible, XO accountable
  { decision_type: DECISION_TYPES.design_revision, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.design_revision, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.design_revision, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.design_revision, position: 'j3', raci_role: 'C' },

  // Escalation — Commander decides
  { decision_type: DECISION_TYPES.escalation, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.escalation, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.escalation, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.escalation, position: 'j5', raci_role: 'I' },
];

// ---------------------------------------------------------------------------
// Operational Echelon Defaults (J-codes — Joint Task Force / Corps level)
// ---------------------------------------------------------------------------

export const OPERATIONAL_RACI_DEFAULTS: RACIDefault[] = [
  // Mission approval
  { decision_type: DECISION_TYPES.mission_approval, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'j5', raci_role: 'C' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'j3', raci_role: 'I' },

  // ROE change
  { decision_type: DECISION_TYPES.roe_change, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j5', raci_role: 'C' },
  { decision_type: DECISION_TYPES.roe_change, position: 'j2', raci_role: 'I' },

  // Force allocation
  { decision_type: DECISION_TYPES.force_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j4', raci_role: 'C' },
  { decision_type: DECISION_TYPES.force_allocation, position: 'j2', raci_role: 'I' },

  // Staff coordination
  { decision_type: DECISION_TYPES.staff_coordination, position: 'xo', raci_role: 'R' },
  { decision_type: DECISION_TYPES.staff_coordination, position: 'commander', raci_role: 'I' },

  // Internal ops
  { decision_type: DECISION_TYPES.internal_ops, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.internal_ops, position: 'commander', raci_role: 'I' },

  // Intel assessment
  { decision_type: DECISION_TYPES.intel_assessment, position: 'j2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'j3', raci_role: 'C' },

  // Threat analysis
  { decision_type: DECISION_TYPES.threat_analysis, position: 'j2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 'j3', raci_role: 'C' },

  // COA development
  { decision_type: DECISION_TYPES.coa_development, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.coa_development, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j4', raci_role: 'C' },
  { decision_type: DECISION_TYPES.coa_development, position: 'j5', raci_role: 'C' },

  // Scheme of maneuver
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'j4', raci_role: 'C' },

  // Fires allocation
  { decision_type: DECISION_TYPES.fires_allocation, position: 'j3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 'j2', raci_role: 'C' },

  // Sustainment plan
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'j3', raci_role: 'C' },

  // Logistics support
  { decision_type: DECISION_TYPES.logistics_support, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.logistics_support, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.logistics_support, position: 'j3', raci_role: 'C' },

  // Force projection
  { decision_type: DECISION_TYPES.force_projection, position: 'j4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_projection, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_projection, position: 'j3', raci_role: 'C' },

  // Campaign plan
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'j4', raci_role: 'C' },

  // Phase transition
  { decision_type: DECISION_TYPES.phase_transition, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'j3', raci_role: 'C' },

  // Strategic design
  { decision_type: DECISION_TYPES.strategic_design, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'j3', raci_role: 'C' },

  // C4ISR architecture
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'j6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'j3', raci_role: 'C' },

  // Network change
  { decision_type: DECISION_TYPES.network_change, position: 'j6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.network_change, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.network_change, position: 'j3', raci_role: 'C' },

  // Order release
  { decision_type: DECISION_TYPES.order_release, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.order_release, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.order_release, position: 'j3', raci_role: 'C' },

  // Design revision
  { decision_type: DECISION_TYPES.design_revision, position: 'j5', raci_role: 'R' },
  { decision_type: DECISION_TYPES.design_revision, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.design_revision, position: 'j2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.design_revision, position: 'j3', raci_role: 'C' },

  // Escalation
  { decision_type: DECISION_TYPES.escalation, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.escalation, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.escalation, position: 'j3', raci_role: 'C' },
];

// ---------------------------------------------------------------------------
// Tactical Echelon Defaults (S-codes — Brigade/Battalion level)
// ---------------------------------------------------------------------------

export const TACTICAL_RACI_DEFAULTS: RACIDefault[] = [
  // Mission approval
  { decision_type: DECISION_TYPES.mission_approval, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.mission_approval, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.mission_approval, position: 's3', raci_role: 'I' },

  // ROE change — tactical commanders typically enforce, not change, ROE
  { decision_type: DECISION_TYPES.roe_change, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.roe_change, position: 's3', raci_role: 'C' },
  { decision_type: DECISION_TYPES.roe_change, position: 's2', raci_role: 'I' },

  // Force allocation
  { decision_type: DECISION_TYPES.force_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_allocation, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_allocation, position: 's4', raci_role: 'C' },
  { decision_type: DECISION_TYPES.force_allocation, position: 's2', raci_role: 'I' },

  // Staff coordination
  { decision_type: DECISION_TYPES.staff_coordination, position: 'xo', raci_role: 'R' },
  { decision_type: DECISION_TYPES.staff_coordination, position: 'commander', raci_role: 'I' },

  // Internal ops
  { decision_type: DECISION_TYPES.internal_ops, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.internal_ops, position: 'commander', raci_role: 'I' },

  // Intel assessment
  { decision_type: DECISION_TYPES.intel_assessment, position: 's2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.intel_assessment, position: 's3', raci_role: 'C' },

  // Threat analysis
  { decision_type: DECISION_TYPES.threat_analysis, position: 's2', raci_role: 'R' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.threat_analysis, position: 's3', raci_role: 'C' },

  // COA development
  { decision_type: DECISION_TYPES.coa_development, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.coa_development, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.coa_development, position: 's2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.coa_development, position: 's4', raci_role: 'C' },

  // Scheme of maneuver
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 's2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.scheme_of_maneuver, position: 's4', raci_role: 'C' },

  // Fires allocation
  { decision_type: DECISION_TYPES.fires_allocation, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.fires_allocation, position: 's2', raci_role: 'C' },

  // Sustainment plan
  { decision_type: DECISION_TYPES.sustainment_plan, position: 's4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.sustainment_plan, position: 's3', raci_role: 'C' },

  // Logistics support
  { decision_type: DECISION_TYPES.logistics_support, position: 's4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.logistics_support, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.logistics_support, position: 's3', raci_role: 'C' },

  // Force projection
  { decision_type: DECISION_TYPES.force_projection, position: 's4', raci_role: 'R' },
  { decision_type: DECISION_TYPES.force_projection, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.force_projection, position: 's3', raci_role: 'C' },

  // Campaign plan — less relevant at tactical level; s3 leads
  { decision_type: DECISION_TYPES.campaign_plan, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 's2', raci_role: 'C' },
  { decision_type: DECISION_TYPES.campaign_plan, position: 's4', raci_role: 'C' },

  // Phase transition
  { decision_type: DECISION_TYPES.phase_transition, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.phase_transition, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.phase_transition, position: 's2', raci_role: 'I' },

  // Strategic design — not typically tactical but mapped to xo/s3
  { decision_type: DECISION_TYPES.strategic_design, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.strategic_design, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.strategic_design, position: 's2', raci_role: 'C' },

  // C4ISR architecture — signal officer at tactical
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 's6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 'commander', raci_role: 'A' },
  { decision_type: DECISION_TYPES.c4isr_architecture, position: 's3', raci_role: 'C' },

  // Network change
  { decision_type: DECISION_TYPES.network_change, position: 's6', raci_role: 'R' },
  { decision_type: DECISION_TYPES.network_change, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.network_change, position: 's3', raci_role: 'C' },

  // Order release
  { decision_type: DECISION_TYPES.order_release, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.order_release, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.order_release, position: 's3', raci_role: 'C' },

  // Design revision
  { decision_type: DECISION_TYPES.design_revision, position: 's3', raci_role: 'R' },
  { decision_type: DECISION_TYPES.design_revision, position: 'xo', raci_role: 'A' },
  { decision_type: DECISION_TYPES.design_revision, position: 's2', raci_role: 'C' },

  // Escalation
  { decision_type: DECISION_TYPES.escalation, position: 'commander', raci_role: 'R' },
  { decision_type: DECISION_TYPES.escalation, position: 'xo', raci_role: 'C' },
  { decision_type: DECISION_TYPES.escalation, position: 's3', raci_role: 'C' },
];

// ---------------------------------------------------------------------------
// Utility: get defaults for a given echelon
// ---------------------------------------------------------------------------

export function getDefaultsForEchelon(echelon: Echelon): RACIDefault[] {
  switch (echelon) {
    case 'strategic':
      return STRATEGIC_RACI_DEFAULTS;
    case 'operational':
      return OPERATIONAL_RACI_DEFAULTS;
    case 'tactical':
      return TACTICAL_RACI_DEFAULTS;
  }
}
