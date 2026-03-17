/**
 * RevisionDiffView
 *
 * Phase 49 Plan 04: Visual before/after comparison component for Design artifact
 * revision proposals. No diff library used — simple field-by-field comparison per
 * RESEARCH.md anti-patterns guidance.
 *
 * Renders two columns: "Current (Design Tab)" on the left and "Proposed Changes"
 * on the right, with red/green/amber highlights for removed/added/changed elements.
 */

import type {
  ProblemFramingData,
  CoGAnalysis,
  LineOfEffort,
  OperationalApproach,
} from '../../lib/design-service.ts';
import type { RevisionArtifactType } from '../../lib/design-revision-service.ts';

// ─── Props ───────────────────────────────────────────────────────────────────

export interface RevisionDiffViewProps {
  artifactType: RevisionArtifactType;
  originalData: unknown;
  proposedData: unknown;
}

// ─── Helper: value changed? ───────────────────────────────────────────────────

function isChanged(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

// ─── Problem Framing diff ─────────────────────────────────────────────────────

function ProblemFramingDiff({
  original,
  proposed,
}: {
  original: ProblemFramingData;
  proposed: ProblemFramingData;
}) {
  const fields: Array<{ key: keyof ProblemFramingData; label: string }> = [
    { key: 'problemStatement', label: 'Problem Statement' },
    { key: 'currentState', label: 'Current State' },
    { key: 'desiredEndState', label: 'Desired End State' },
  ];

  return (
    <div className="rdv-field-list">
      {fields.map(({ key, label }) => {
        const origVal = (original[key] as string) || '';
        const propVal = (proposed[key] as string) || '';
        const changed = origVal !== propVal;
        return (
          <div key={key} className="rdv-field-row">
            <div className="rdv-field-label">{label}</div>
            <div className="rdv-columns">
              <div className={`rdv-col rdv-col--original${changed ? ' rdv-changed' : ''}`}>
                <span className="rdv-col-header">Current</span>
                <p className="rdv-text">{origVal || <em className="rdv-empty">Empty</em>}</p>
              </div>
              <div className={`rdv-col rdv-col--proposed${changed ? ' rdv-col--modified' : ''}`}>
                <span className="rdv-col-header">Proposed</span>
                <p className="rdv-text">{propVal || <em className="rdv-empty">Empty</em>}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CoG Analysis diff ────────────────────────────────────────────────────────

function CoGSideDiff({
  label,
  original,
  proposed,
}: {
  label: string;
  original: CoGAnalysis['friendly'];
  proposed: CoGAnalysis['friendly'];
}) {
  const origRoot = original?.root;
  const propRoot = proposed?.root;

  const getByType = (root: typeof origRoot, type: string) =>
    root ? (root.children ?? []).filter((c) => c.type === type) : [];

  const types: Array<{ type: string; short: string }> = [
    { type: 'critical-capability', short: 'CC' },
    { type: 'critical-requirement', short: 'CR' },
    { type: 'critical-vulnerability', short: 'CV' },
  ];

  return (
    <div className="rdv-cog-side">
      <h4 className="rdv-cog-label">{label}</h4>
      <div className="rdv-columns">
        {/* Original */}
        <div className="rdv-col rdv-col--original">
          <span className="rdv-col-header">Current</span>
          {origRoot ? (
            <div>
              <div className="rdv-cog-row">
                <span className="rdv-cog-type">CoG</span>
                <span>{origRoot.label}</span>
              </div>
              {types.map(({ type, short }) => {
                const nodes = getByType(origRoot, type);
                return nodes.length > 0 ? (
                  <div key={type} className="rdv-cog-row">
                    <span className="rdv-cog-type">{short}</span>
                    <span>{nodes.map((n) => n.label).join(', ')}</span>
                  </div>
                ) : null;
              })}
            </div>
          ) : (
            <em className="rdv-empty">Not defined</em>
          )}
        </div>
        {/* Proposed */}
        <div
          className={`rdv-col rdv-col--proposed${isChanged(origRoot, propRoot) ? ' rdv-col--modified' : ''}`}
        >
          <span className="rdv-col-header">Proposed</span>
          {propRoot ? (
            <div>
              <div className="rdv-cog-row">
                <span className="rdv-cog-type">CoG</span>
                <span
                  className={isChanged(origRoot?.label, propRoot.label) ? 'rdv-highlight-changed' : ''}
                >
                  {propRoot.label}
                </span>
              </div>
              {types.map(({ type, short }) => {
                const origNodes = getByType(origRoot, type);
                const propNodes = getByType(propRoot, type);
                return propNodes.length > 0 ? (
                  <div key={type} className="rdv-cog-row">
                    <span className="rdv-cog-type">{short}</span>
                    <span
                      className={
                        isChanged(origNodes.map((n) => n.label), propNodes.map((n) => n.label))
                          ? 'rdv-highlight-changed'
                          : ''
                      }
                    >
                      {propNodes.map((n) => n.label).join(', ')}
                    </span>
                  </div>
                ) : null;
              })}
            </div>
          ) : (
            <em className="rdv-empty">Not defined</em>
          )}
        </div>
      </div>
    </div>
  );
}

function CoGAnalysisDiff({
  original,
  proposed,
}: {
  original: CoGAnalysis;
  proposed: CoGAnalysis;
}) {
  return (
    <div className="rdv-cog-grid">
      <CoGSideDiff
        label="Friendly CoG"
        original={original?.friendly ?? { root: null }}
        proposed={proposed?.friendly ?? { root: null }}
      />
      <CoGSideDiff
        label="Adversary CoG"
        original={original?.adversary ?? { root: null }}
        proposed={proposed?.adversary ?? { root: null }}
      />
    </div>
  );
}

// ─── Lines of Effort diff ─────────────────────────────────────────────────────

function LinesOfEffortDiff({
  original,
  proposed,
}: {
  original: LineOfEffort[];
  proposed: LineOfEffort[];
}) {
  const origIds = new Set(original.map((l) => l.id));
  const propIds = new Set(proposed.map((l) => l.id));

  const removed = original.filter((l) => !propIds.has(l.id));
  const added = proposed.filter((l) => !origIds.has(l.id));
  const kept = proposed.filter((l) => origIds.has(l.id));
  const modified = kept.filter((propLoe) => {
    const origLoe = original.find((o) => o.id === propLoe.id);
    return origLoe && isChanged(origLoe, propLoe);
  });
  const unchanged = kept.filter((propLoe) => {
    const origLoe = original.find((o) => o.id === propLoe.id);
    return origLoe && !isChanged(origLoe, propLoe);
  });

  return (
    <div className="rdv-loe-list">
      {unchanged.map((loe) => (
        <div key={loe.id} className="rdv-loe-row rdv-loe-row--unchanged">
          <span className="rdv-loe-indicator" title="Unchanged">~</span>
          <span className="rdv-loe-name">{loe.name}</span>
        </div>
      ))}
      {modified.map((loe) => (
        <div key={loe.id} className="rdv-loe-row rdv-loe-row--modified">
          <span className="rdv-loe-indicator rdv-indicator--modified" title="Modified">~</span>
          <div>
            <span className="rdv-loe-name">{loe.name}</span>
            {loe.description && (
              <span className="rdv-loe-desc">{loe.description}</span>
            )}
          </div>
        </div>
      ))}
      {removed.map((loe) => (
        <div key={loe.id} className="rdv-loe-row rdv-loe-row--removed">
          <span className="rdv-loe-indicator rdv-indicator--removed" title="Removed">-</span>
          <span className="rdv-loe-name rdv-text--strikethrough">{loe.name}</span>
        </div>
      ))}
      {added.map((loe) => (
        <div key={loe.id} className="rdv-loe-row rdv-loe-row--added">
          <span className="rdv-loe-indicator rdv-indicator--added" title="Added">+</span>
          <div>
            <span className="rdv-loe-name">{loe.name}</span>
            {loe.description && (
              <span className="rdv-loe-desc">{loe.description}</span>
            )}
          </div>
        </div>
      ))}
      {removed.length === 0 && added.length === 0 && modified.length === 0 && (
        <p className="rdv-no-changes">No changes to lines of effort.</p>
      )}
    </div>
  );
}

// ─── Phases diff ──────────────────────────────────────────────────────────────

function PhasesDiff({
  original,
  proposed,
}: {
  original: OperationalApproach;
  proposed: OperationalApproach;
}) {
  const origPhases = original?.phases ?? [];
  const propPhases = proposed?.phases ?? [];

  const origIds = new Set(origPhases.map((p) => p.id));
  const propIds = new Set(propPhases.map((p) => p.id));

  const removed = origPhases.filter((p) => !propIds.has(p.id));
  const added = propPhases.filter((p) => !origIds.has(p.id));

  const sorted = [...propPhases].sort((a, b) => a.order - b.order);

  return (
    <div className="rdv-phases-list">
      {sorted.map((phase, i) => {
        const orig = origPhases.find((p) => p.id === phase.id);
        const changed = orig ? isChanged(orig, phase) : false;
        const isNew = !origIds.has(phase.id);

        return (
          <div
            key={phase.id}
            className={`rdv-phase-row${isNew ? ' rdv-phase-row--added' : changed ? ' rdv-phase-row--modified' : ''}`}
          >
            <span className="rdv-phase-number">{i + 1}</span>
            <div className="rdv-phase-content">
              <span className="rdv-phase-name">{phase.name}</span>
              {phase.description && (
                <span className="rdv-phase-desc">{phase.description}</span>
              )}
              {isNew && <span className="rdv-tag rdv-tag--added">New</span>}
              {changed && !isNew && <span className="rdv-tag rdv-tag--modified">Modified</span>}
            </div>
          </div>
        );
      })}
      {removed.map((phase) => (
        <div key={phase.id} className="rdv-phase-row rdv-phase-row--removed">
          <span className="rdv-phase-number">-</span>
          <div className="rdv-phase-content">
            <span className="rdv-phase-name rdv-text--strikethrough">{phase.name}</span>
            <span className="rdv-tag rdv-tag--removed">Removed</span>
          </div>
        </div>
      ))}
      {removed.length === 0 && added.length === 0 && !isChanged(origPhases, propPhases) && (
        <p className="rdv-no-changes">No changes to phases.</p>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function RevisionDiffView({
  artifactType,
  originalData,
  proposedData,
}: RevisionDiffViewProps) {
  return (
    <div className="rdv-container">
      {artifactType === 'problem-framing' && (
        <ProblemFramingDiff
          original={(originalData as ProblemFramingData) ?? ({} as ProblemFramingData)}
          proposed={(proposedData as ProblemFramingData) ?? ({} as ProblemFramingData)}
        />
      )}
      {artifactType === 'cog-analysis' && (
        <CoGAnalysisDiff
          original={(originalData as CoGAnalysis) ?? ({ friendly: { root: null }, adversary: { root: null } } as CoGAnalysis)}
          proposed={(proposedData as CoGAnalysis) ?? ({ friendly: { root: null }, adversary: { root: null } } as CoGAnalysis)}
        />
      )}
      {artifactType === 'lines-of-effort' && (
        <LinesOfEffortDiff
          original={(originalData as LineOfEffort[]) ?? []}
          proposed={(proposedData as LineOfEffort[]) ?? []}
        />
      )}
      {artifactType === 'operational-approach' && (
        <PhasesDiff
          original={(originalData as OperationalApproach) ?? ({ phases: [], transitions: [], decisionPoints: [], narrative: '' } as OperationalApproach)}
          proposed={(proposedData as OperationalApproach) ?? ({ phases: [], transitions: [], decisionPoints: [], narrative: '' } as OperationalApproach)}
        />
      )}
    </div>
  );
}
