/**
 * ForceApportionmentPanel
 *
 * Phase 36 Plan 03: LOE-based force allocation visualization with
 * priority tier badges, allocation bars, and summary dashboard.
 */

import { useState, useEffect, useCallback } from 'react';
import { sgService } from '../../lib/strategic-guidance-service.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ForceAllocationPriority = 'main_effort' | 'supporting_effort' | 'reserve' | 'economy_of_force';

interface ForceAllocation {
  id: string;
  forceId: string;
  forceName: string;
  forceType: string;
  isRegistered: boolean;
  lineOfEffortId: string;
  priority: ForceAllocationPriority;
  allocationPct: number;
  notes: string;
}

interface LineOfEffort {
  id: string;
  name: string;
  description: string;
  linkedObjectiveIds: string[];
  allocatedForces: ForceAllocation[];
}

interface ForceApportionmentPanelProps {
  instanceId: string;
  linesOfEffort: LineOfEffort[];
  onAllocationsChange?: () => void;
}

interface AddForceForm {
  forceName: string;
  forceType: string;
  priority: ForceAllocationPriority;
  allocationPct: number;
  notes: string;
}

const EMPTY_FORM: AddForceForm = {
  forceName: '',
  forceType: '',
  priority: 'supporting_effort',
  allocationPct: 0,
  notes: '',
};

// ---------------------------------------------------------------------------
// Priority config
// ---------------------------------------------------------------------------

const PRIORITY_CONFIG: Record<ForceAllocationPriority, { label: string; color: string; bg: string; border: string }> = {
  main_effort: { label: 'Main Effort', color: '#fca5a5', bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)' },
  supporting_effort: { label: 'Supporting', color: '#93c5fd', bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.4)' },
  reserve: { label: 'Reserve', color: '#86efac', bg: 'rgba(34, 197, 94, 0.15)', border: 'rgba(34, 197, 94, 0.4)' },
  economy_of_force: { label: 'Economy', color: '#9ca3af', bg: 'rgba(107, 114, 128, 0.15)', border: 'rgba(107, 114, 128, 0.4)' },
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  backgroundColor: 'rgba(17, 24, 39, 0.5)',
  borderRadius: '0.375rem',
  padding: '0.625rem',
  marginBottom: '0.375rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: 'rgba(17, 24, 39, 0.6)',
  border: '1px solid rgba(75, 85, 99, 0.4)',
  borderRadius: '0.25rem',
  padding: '0.25rem 0.5rem',
  color: '#d1d5db',
  fontSize: '0.8rem',
  fontFamily: 'inherit',
};

const labelStyle: React.CSSProperties = {
  fontSize: '0.7rem',
  fontWeight: 500,
  color: '#9ca3af',
  marginBottom: '0.125rem',
};

const btnStyle: React.CSSProperties = {
  padding: '0.25rem 0.5rem',
  fontSize: '0.7rem',
  backgroundColor: 'rgba(59, 130, 246, 0.15)',
  border: '1px solid rgba(59, 130, 246, 0.3)',
  borderRadius: '0.25rem',
  color: '#93c5fd',
  cursor: 'pointer',
};

const removeBtnStyle: React.CSSProperties = {
  padding: '0.125rem 0.375rem',
  fontSize: '0.65rem',
  backgroundColor: 'rgba(239, 68, 68, 0.15)',
  border: '1px solid rgba(239, 68, 68, 0.3)',
  borderRadius: '0.25rem',
  color: '#fca5a5',
  cursor: 'pointer',
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PriorityBadge({ priority }: { priority: ForceAllocationPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span
      style={{
        fontSize: '0.65rem',
        padding: '0.125rem 0.375rem',
        backgroundColor: cfg.bg,
        border: `1px solid ${cfg.border}`,
        borderRadius: '0.25rem',
        color: cfg.color,
        fontWeight: 500,
      }}
    >
      {cfg.label}
    </span>
  );
}

function AllocationBar({ pct }: { pct: number }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const barColor = clampedPct > 100 ? '#ef4444' : clampedPct > 75 ? '#eab308' : '#3b82f6';

  return (
    <div
      style={{
        width: '100%',
        height: '6px',
        backgroundColor: 'rgba(75, 85, 99, 0.3)',
        borderRadius: '3px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${clampedPct}%`,
          height: '100%',
          backgroundColor: barColor,
          borderRadius: '3px',
          transition: 'width 0.2s',
        }}
      />
    </div>
  );
}

function ForceCard({
  force,
  onRemove,
}: {
  force: ForceAllocation;
  onRemove: () => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.375rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.85rem', color: '#e5e7eb', fontWeight: 500 }}>
            {force.forceName}
          </span>
          <span style={{ fontSize: '0.7rem', color: '#6b7280' }}>{force.forceType}</span>
          <PriorityBadge priority={force.priority} />
          {force.isRegistered ? (
            <span style={{ fontSize: '0.7rem', color: '#22c55e' }} title="Registered in resource registry">
              &#10003;
            </span>
          ) : (
            <span style={{ fontSize: '0.7rem', color: '#eab308' }} title="Not registered">
              &#9888;
            </span>
          )}
        </div>
        <button style={removeBtnStyle} onClick={onRemove}>
          Remove
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
        <AllocationBar pct={force.allocationPct} />
        <span style={{ fontSize: '0.7rem', color: '#9ca3af', minWidth: '2.5rem', textAlign: 'right' }}>
          {force.allocationPct}%
        </span>
      </div>
      {force.notes && (
        <p style={{ fontSize: '0.7rem', color: '#6b7280', margin: '0.25rem 0 0' }}>
          {force.notes}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function ForceApportionmentPanel({
  instanceId,
  linesOfEffort,
  onAllocationsChange,
}: ForceApportionmentPanelProps) {
  const [allocations, setAllocations] = useState<ForceAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingForLOE, setAddingForLOE] = useState<string | null>(null);
  const [addForm, setAddForm] = useState<AddForceForm>(EMPTY_FORM);

  const loadAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sgService.getForceAllocations(instanceId);
      // Map API response to local ForceAllocation shape
      const mapped: ForceAllocation[] = (data as unknown as ForceAllocation[]).map((a) => ({
        id: a.id,
        forceId: a.forceId ?? a.id,
        forceName: a.forceName ?? (a as Record<string, unknown>).unitName as string ?? '',
        forceType: a.forceType ?? (a as Record<string, unknown>).unitType as string ?? '',
        isRegistered: a.isRegistered ?? false,
        lineOfEffortId: a.lineOfEffortId ?? (a as Record<string, unknown>).lineOfEffort as string ?? '',
        priority: a.priority ?? 'supporting_effort',
        allocationPct: a.allocationPct ?? (a as Record<string, unknown>).allocation as number ?? 0,
        notes: a.notes ?? '',
      }));
      setAllocations(mapped);
    } catch {
      // No allocations yet
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  const handleAddForce = async (loeId: string) => {
    try {
      await sgService.saveForceAllocation(instanceId, {
        unitName: addForm.forceName,
        unitType: addForm.forceType,
        lineOfEffort: loeId,
        allocation: addForm.allocationPct,
        notes: addForm.notes,
      });
      setAddingForLOE(null);
      setAddForm(EMPTY_FORM);
      await loadAllocations();
      onAllocationsChange?.();
    } catch (err) {
      console.error('[ForceApportionmentPanel] Save failed:', err);
    }
  };

  const handleRemoveForce = async (allocationId: string) => {
    try {
      await sgService.deleteForceAllocation(instanceId, allocationId);
      await loadAllocations();
      onAllocationsChange?.();
    } catch (err) {
      console.error('[ForceApportionmentPanel] Delete failed:', err);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '0.5rem', color: '#9ca3af', fontSize: '0.8rem' }}>
        Loading force allocations...
      </div>
    );
  }

  // Summary dashboard calculations
  const totalForces = allocations.length;
  const mainEffortCount = allocations.filter((a) => a.priority === 'main_effort').length;
  const totalCommitted = allocations.reduce((sum, a) => sum + a.allocationPct, 0);

  // Check over-allocation per LOE
  const loeAllocTotals: Record<string, number> = {};
  allocations.forEach((a) => {
    loeAllocTotals[a.lineOfEffortId] = (loeAllocTotals[a.lineOfEffortId] ?? 0) + a.allocationPct;
  });
  const overAllocatedLOEs = Object.entries(loeAllocTotals).filter(([, total]) => total > 100);

  return (
    <div>
      {/* Summary Dashboard */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          flexWrap: 'wrap',
          backgroundColor: 'rgba(17, 24, 39, 0.5)',
          borderRadius: '0.375rem',
          padding: '0.625rem 0.75rem',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>Total Forces</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e5e7eb' }}>{totalForces}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>Main Effort</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fca5a5' }}>{mainEffortCount}</div>
        </div>
        <div>
          <div style={{ fontSize: '0.65rem', color: '#6b7280', textTransform: 'uppercase' }}>Committed</div>
          <div style={{ fontSize: '1.1rem', fontWeight: 600, color: '#93c5fd' }}>{totalCommitted}%</div>
        </div>
        {overAllocatedLOEs.length > 0 && (
          <div>
            <div style={{ fontSize: '0.65rem', color: '#ef4444', textTransform: 'uppercase' }}>Over-allocated</div>
            <div style={{ fontSize: '0.8rem', color: '#fca5a5' }}>
              {overAllocatedLOEs.map(([loeId, total]) => {
                const loe = linesOfEffort.find((l) => l.id === loeId);
                return `${loe?.name ?? loeId} (${total}%)`;
              }).join(', ')}
            </div>
          </div>
        )}
      </div>

      {/* LOE Sections */}
      {linesOfEffort.length === 0 && (
        <div style={{ padding: '0.75rem', color: '#6b7280', fontSize: '0.8rem', fontStyle: 'italic' }}>
          Define Lines of Effort above to allocate forces.
        </div>
      )}

      {linesOfEffort.map((loe) => {
        const loeForces = allocations.filter((a) => a.lineOfEffortId === loe.id);
        const loeTotalPct = loeForces.reduce((sum, a) => sum + a.allocationPct, 0);

        return (
          <div
            key={loe.id}
            style={{
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              borderRadius: '0.375rem',
              padding: '0.75rem',
              marginBottom: '0.75rem',
            }}
          >
            {/* LOE Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <div>
                <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#e5e7eb', fontWeight: 600 }}>
                  {loe.name}
                </h4>
                {loe.description && (
                  <p style={{ margin: '0.125rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                    {loe.description}
                  </p>
                )}
              </div>
              <span
                style={{
                  fontSize: '0.7rem',
                  color: loeTotalPct > 100 ? '#ef4444' : '#9ca3af',
                  fontWeight: loeTotalPct > 100 ? 600 : 400,
                }}
              >
                {loeTotalPct}% allocated
              </span>
            </div>

            {/* Force cards */}
            {loeForces.map((force) => (
              <ForceCard
                key={force.id}
                force={force}
                onRemove={() => handleRemoveForce(force.id)}
              />
            ))}

            {/* Add Force form or button */}
            {addingForLOE === loe.id ? (
              <div style={{ ...cardStyle, border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelStyle}>Force Name</label>
                    <input
                      style={inputStyle}
                      value={addForm.forceName}
                      placeholder="e.g., 1st Marine Division"
                      onChange={(e) => setAddForm({ ...addForm, forceName: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelStyle}>Force Type</label>
                    <input
                      style={inputStyle}
                      value={addForm.forceType}
                      placeholder="e.g., Division, Brigade"
                      onChange={(e) => setAddForm({ ...addForm, forceType: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.375rem' }}>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelStyle}>Priority</label>
                    <select
                      style={{ ...inputStyle, cursor: 'pointer' }}
                      value={addForm.priority}
                      onChange={(e) => setAddForm({ ...addForm, priority: e.target.value as ForceAllocationPriority })}
                    >
                      <option value="main_effort">Main Effort</option>
                      <option value="supporting_effort">Supporting Effort</option>
                      <option value="reserve">Reserve</option>
                      <option value="economy_of_force">Economy of Force</option>
                    </select>
                  </div>
                  <div style={{ flex: 1, minWidth: '120px' }}>
                    <label style={labelStyle}>Allocation %</label>
                    <input
                      style={inputStyle}
                      type="number"
                      min={0}
                      max={100}
                      value={addForm.allocationPct}
                      onChange={(e) => setAddForm({ ...addForm, allocationPct: Number(e.target.value) })}
                    />
                  </div>
                </div>
                <div style={{ marginBottom: '0.375rem' }}>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: '2.5rem',
                      resize: 'vertical',
                    }}
                    value={addForm.notes}
                    placeholder="Optional notes..."
                    onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    style={{ ...btnStyle, backgroundColor: 'rgba(34, 197, 94, 0.15)', borderColor: 'rgba(34, 197, 94, 0.3)', color: '#86efac' }}
                    onClick={() => handleAddForce(loe.id)}
                    disabled={!addForm.forceName.trim()}
                  >
                    Save Force
                  </button>
                  <button
                    style={{ ...btnStyle, backgroundColor: 'rgba(107, 114, 128, 0.15)', borderColor: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af' }}
                    onClick={() => { setAddingForLOE(null); setAddForm(EMPTY_FORM); }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                style={btnStyle}
                onClick={() => { setAddingForLOE(loe.id); setAddForm(EMPTY_FORM); }}
              >
                + Add Force
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
