/**
 * OperationalAssess
 *
 * Phase 37 Plan 03: Full operational mode Assess view with TabLayout sidebar.
 * Sidebar items: MOE Overview, MOP Overview, Reframing.
 *
 * - MOE Overview: grid of MOECards with Add MOE form
 * - MOP Overview: grid of MOPCards with Add MOP form
 * - Reframing: preserved from existing AssessTab (GateSubmitButton, post-reframing)
 *   with new reframing trigger banner from assessment data
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout, type SidebarItem } from '../tabs/TabLayout.js';
import {
  DecisionGateBanner,
  GateSubmitButton,
  DecisionGateTimeline,
  GateStatusBadge,
} from '../governance/index.js';
import { useDecisionGates } from '../../context/DecisionGateContext.js';
import { useUser } from '../../context/UserContext.js';
import type { DecisionGate } from '../../lib/gate-service';
import {
  assessmentService,
  type AssessmentMOE,
  type AssessmentMOP,
  type ReframingTriggerResult,
} from '../../lib/assessment-service';
import { MOECard } from './MOECard.tsx';
import { MOPCard } from './MOPCard.tsx';

// ============================================================================
// Types
// ============================================================================

type OpsAssessView = 'moe-overview' | 'mop-overview' | 'reframing';

// ============================================================================
// Sidebar Configuration
// ============================================================================

const OPS_ASSESS_ITEMS: SidebarItem[] = [
  { id: 'moe-overview', label: 'MOE Overview' },
  { id: 'mop-overview', label: 'MOP Overview' },
  { id: 'reframing', label: 'Reframing' },
];

// ============================================================================
// Component
// ============================================================================

interface OperationalAssessProps {
  problemSetId: string;
}

export function OperationalAssess({ problemSetId }: OperationalAssessProps) {
  const [selectedView, setSelectedView] = useState<OpsAssessView>('moe-overview');
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  const { gates } = useDecisionGates('assess');
  const { userDID } = useUser();

  // ─── Data state ──────────────────────────────────────────────────────────

  const [moes, setMoes] = useState<AssessmentMOE[]>([]);
  const [mops, setMops] = useState<AssessmentMOP[]>([]);
  const [reframingTrigger, setReframingTrigger] = useState<ReframingTriggerResult | null>(null);
  const [loadingMOEs, setLoadingMOEs] = useState(false);
  const [loadingMOPs, setLoadingMOPs] = useState(false);

  // ─── Add MOE form state ──────────────────────────────────────────────────

  const [showAddMOE, setShowAddMOE] = useState(false);
  const [moeFormName, setMoeFormName] = useState('');
  const [moeFormDesc, setMoeFormDesc] = useState('');
  const [moeFormObjSnapshot, setMoeFormObjSnapshot] = useState('');
  const [moeFormSaving, setMoeFormSaving] = useState(false);

  // ─── Add MOP form state ──────────────────────────────────────────────────

  const [showAddMOP, setShowAddMOP] = useState(false);
  const [mopFormName, setMopFormName] = useState('');
  const [mopFormDesc, setMopFormDesc] = useState('');
  const [mopFormTaskSnapshot, setMopFormTaskSnapshot] = useState('');
  const [mopFormStandard, setMopFormStandard] = useState('');
  const [mopFormSaving, setMopFormSaving] = useState(false);

  // ─── Data fetching ───────────────────────────────────────────────────────

  const loadMOEs = useCallback(async () => {
    if (!problemSetId) return;
    setLoadingMOEs(true);
    try {
      const data = await assessmentService.listMOEs(problemSetId);
      setMoes(data);
    } catch (err) {
      console.error('[OperationalAssess] Failed to load MOEs:', err);
    } finally {
      setLoadingMOEs(false);
    }
  }, [problemSetId]);

  const loadMOPs = useCallback(async () => {
    if (!problemSetId) return;
    setLoadingMOPs(true);
    try {
      const data = await assessmentService.listMOPs(problemSetId);
      setMops(data);
    } catch (err) {
      console.error('[OperationalAssess] Failed to load MOPs:', err);
    } finally {
      setLoadingMOPs(false);
    }
  }, [problemSetId]);

  const loadReframingTrigger = useCallback(async () => {
    if (!problemSetId) return;
    try {
      const result = await assessmentService.checkReframingTrigger(problemSetId);
      setReframingTrigger(result);
    } catch {
      // Non-fatal — banner just won't show
    }
  }, [problemSetId]);

  useEffect(() => {
    loadMOEs();
    loadMOPs();
    loadReframingTrigger();
  }, [loadMOEs, loadMOPs, loadReframingTrigger]);

  // ─── Handlers ────────────────────────────────────────────────────────────

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[OperationalAssess] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

  const handleAddMOE = async () => {
    if (!moeFormName.trim() || !userDID) return;
    setMoeFormSaving(true);
    try {
      await assessmentService.createMOE({
        problemSetId,
        name: moeFormName.trim(),
        description: moeFormDesc.trim() || undefined,
        objectiveSnapshot: moeFormObjSnapshot.trim() || '',
        createdBy: userDID,
      });
      setMoeFormName('');
      setMoeFormDesc('');
      setMoeFormObjSnapshot('');
      setShowAddMOE(false);
      loadMOEs();
    } catch (err) {
      console.error('[OperationalAssess] Failed to create MOE:', err);
    } finally {
      setMoeFormSaving(false);
    }
  };

  const handleAddMOP = async () => {
    if (!mopFormName.trim() || !userDID) return;
    setMopFormSaving(true);
    try {
      await assessmentService.createMOP({
        problemSetId,
        name: mopFormName.trim(),
        description: mopFormDesc.trim() || undefined,
        taskSnapshot: mopFormTaskSnapshot.trim() || '',
        standard: mopFormStandard.trim() || undefined,
        createdBy: userDID,
      });
      setMopFormName('');
      setMopFormDesc('');
      setMopFormTaskSnapshot('');
      setMopFormStandard('');
      setShowAddMOP(false);
      loadMOPs();
    } catch (err) {
      console.error('[OperationalAssess] Failed to create MOP:', err);
    } finally {
      setMopFormSaving(false);
    }
  };

  // Collect approved gates for the decision record
  const approvedGates = gates.filter(
    (g) => g.status === 'approved' || g.status === 'overridden'
  );

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <TabLayout
      items={OPS_ASSESS_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as OpsAssessView)}
      decisionHistory={
        <DecisionGateTimeline tabId="assess" onEntryClick={handleGateDetailClick} />
      }
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="assess" />

      {/* ── MOE Overview ──────────────────────────────────────────────────── */}
      {selectedView === 'moe-overview' && (
        <div className="ops-assess-section">
          <div className="ops-assess-section-header">
            <h2>Measures of Effectiveness</h2>
            <button
              className="add-measure-btn"
              onClick={() => setShowAddMOE(!showAddMOE)}
            >
              + Add MOE
            </button>
          </div>

          {showAddMOE && (
            <div className="add-measure-form">
              <input
                type="text"
                placeholder="MOE name"
                value={moeFormName}
                onChange={(e) => setMoeFormName(e.target.value)}
              />
              <textarea
                placeholder="Description (optional)"
                value={moeFormDesc}
                onChange={(e) => setMoeFormDesc(e.target.value)}
              />
              <input
                type="text"
                placeholder="Linked objective (snapshot text)"
                value={moeFormObjSnapshot}
                onChange={(e) => setMoeFormObjSnapshot(e.target.value)}
              />
              <div className="add-measure-form-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowAddMOE(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-save"
                  onClick={handleAddMOE}
                  disabled={moeFormSaving || !moeFormName.trim()}
                >
                  {moeFormSaving ? 'Saving...' : 'Create MOE'}
                </button>
              </div>
            </div>
          )}

          {loadingMOEs ? (
            <div className="ops-assess-empty">Loading MOEs...</div>
          ) : moes.length > 0 ? (
            <div className="moe-grid">
              {moes.map((moe) => (
                <MOECard key={moe.id} moe={moe} />
              ))}
            </div>
          ) : (
            <div className="ops-assess-empty">
              No MOEs defined yet. Create MOEs linked to operational objectives from the Design tab.
            </div>
          )}
        </div>
      )}

      {/* ── MOP Overview ──────────────────────────────────────────────────── */}
      {selectedView === 'mop-overview' && (
        <div className="ops-assess-section">
          <div className="ops-assess-section-header">
            <h2>Measures of Performance</h2>
            <button
              className="add-measure-btn"
              onClick={() => setShowAddMOP(!showAddMOP)}
            >
              + Add MOP
            </button>
          </div>

          {showAddMOP && (
            <div className="add-measure-form">
              <input
                type="text"
                placeholder="MOP name"
                value={mopFormName}
                onChange={(e) => setMopFormName(e.target.value)}
              />
              <textarea
                placeholder="Description (optional)"
                value={mopFormDesc}
                onChange={(e) => setMopFormDesc(e.target.value)}
              />
              <input
                type="text"
                placeholder="Linked task (snapshot text)"
                value={mopFormTaskSnapshot}
                onChange={(e) => setMopFormTaskSnapshot(e.target.value)}
              />
              <input
                type="text"
                placeholder="Standard (what 'to standard' means)"
                value={mopFormStandard}
                onChange={(e) => setMopFormStandard(e.target.value)}
              />
              <div className="add-measure-form-actions">
                <button
                  className="btn-cancel"
                  onClick={() => setShowAddMOP(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn-save"
                  onClick={handleAddMOP}
                  disabled={mopFormSaving || !mopFormName.trim()}
                >
                  {mopFormSaving ? 'Saving...' : 'Create MOP'}
                </button>
              </div>
            </div>
          )}

          {loadingMOPs ? (
            <div className="ops-assess-empty">Loading MOPs...</div>
          ) : mops.length > 0 ? (
            <div className="mop-grid">
              {mops.map((mop) => (
                <MOPCard key={mop.id} mop={mop} />
              ))}
            </div>
          ) : (
            <div className="ops-assess-empty">
              No MOPs defined yet. Create MOPs linked to operational tasks from the Plan tab.
            </div>
          )}
        </div>
      )}

      {/* ── Reframing ─────────────────────────────────────────────────────── */}
      {selectedView === 'reframing' && (
        <div className="assess-reframing">
          {/* Reframing trigger banner from assessment data */}
          {reframingTrigger?.shouldTrigger && (
            <div className="reframing-alert">
              <span className="reframing-alert-icon">&#9888;</span>
              Assessment data suggests reframing may be needed: {reframingTrigger.decliningMOEs} declining
              MOE{reframingTrigger.decliningMOEs !== 1 ? 's' : ''}, {reframingTrigger.redMOPs} critical
              MOP{reframingTrigger.redMOPs !== 1 ? 's' : ''}.
            </div>
          )}

          <h2>Reframing Decision</h2>
          <p className="assess-description">
            Reframing occurs when the current operational approach is assessed as inadequate
            to achieve objectives. Submit a reframing recommendation for commander approval.
          </p>

          <div className="reframing-submit-section">
            <GateSubmitButton
              gateType="reframing"
              itemId={problemSetId}
              itemTitle="Reframing Recommendation"
              itemDescription="Assessment-driven recommendation to reframe the operational approach"
              tabId="assess"
            />
          </div>

          <section className="assess-section reframing-post-actions">
            <h3>Post-Reframing Actions</h3>
            <p className="assess-section-note">
              When reframing is approved, updated guidance and directives will be generated.
              This section will display post-reframing actions in a future update.
            </p>
            <div className="assess-placeholder-card">
              <span className="placeholder-label">Available after reframing approval</span>
            </div>
          </section>

          {/* Decision Record (preserved from original AssessTab) */}
          <section className="assess-section">
            <h3>Decision Record</h3>
            <p className="assess-section-note">
              Governance decisions approved for this problem set.
            </p>
            {approvedGates.length > 0 ? (
              <div className="decision-record-list">
                {approvedGates.map((gate) => (
                  <div key={gate.id} className="decision-record-item">
                    <div className="decision-record-title">
                      {gate.target_item_title || gate.gate_type}
                    </div>
                    <div className="decision-record-meta">
                      <GateStatusBadge status={gate.status} />
                      {gate.decided_at && (
                        <span className="decision-record-date">
                          {new Date(gate.decided_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="assess-placeholder-card">
                <span className="placeholder-label">No approved decisions yet</span>
              </div>
            )}
          </section>
        </div>
      )}
    </TabLayout>
  );
}
