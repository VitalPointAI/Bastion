/**
 * DesignOverview
 *
 * Phase 25 Plan 05: Updated dashboard with live section summaries,
 * progress bar, and rich data cards per JP 5-0 workflow.
 */

import type { OperationalDesign, CoGNode, SectionStatus } from '../../lib/design-service.ts';
import { DesignStatusBadge } from './DesignStatusBadge.tsx';
import { DesignSyncIndicator } from './DesignSyncIndicator.tsx';

interface DesignOverviewProps {
  designData: OperationalDesign;
  onNavigate: (view: string) => void;
}

interface SectionCard {
  id: string;
  name: string;
  description: string;
  statusKey: keyof OperationalDesign['status'];
}

const SECTION_CARDS: SectionCard[] = [
  {
    id: 'problem-framing',
    name: 'Problem Framing',
    description: 'Define the problem -- current state, desired end state, tensions, and constraints',
    statusKey: 'problemFraming',
  },
  {
    id: 'cog-analysis',
    name: 'CoG Analysis',
    description: "Identify centers of gravity using Strange's CG-CC-CR-CV framework",
    statusKey: 'cogAnalysis',
  },
  {
    id: 'lines-of-effort',
    name: 'Lines of Effort',
    description: 'Define lines of effort/operation with decisive points and phasing',
    statusKey: 'linesOfEffort',
  },
  {
    id: 'operational-approach',
    name: 'Operational Approach',
    description: 'Synthesize analysis into a coherent operational approach',
    statusKey: 'operationalApproach',
  },
];

// ─── Helper: count CoG nodes recursively ──────────────────────────────────────

function countCoGNodes(node: CoGNode | null): number {
  if (!node) return 0;
  return 1 + (node.children ?? []).reduce((sum, c) => sum + countCoGNodes(c), 0);
}

// ─── Section-specific summary renderers ──────────────────────────────────────

function getProblemFramingSummary(designData: OperationalDesign): string | null {
  const pf = designData.problemFraming;
  if (!pf) return null;

  if (pf.problemStatement) {
    const truncated =
      pf.problemStatement.length > 100
        ? pf.problemStatement.slice(0, 100) + '...'
        : pf.problemStatement;
    const parts: string[] = [truncated];
    const assumptionCount = (pf.assumptions ?? []).length;
    const constraintCount = (pf.constraints ?? []).length;
    if (assumptionCount > 0 || constraintCount > 0) {
      parts.push(
        `${assumptionCount} assumption${assumptionCount !== 1 ? 's' : ''}, ${constraintCount} constraint${constraintCount !== 1 ? 's' : ''}`
      );
    }
    return parts.join(' | ');
  }

  if (pf.currentState || pf.desiredEndState) return 'Partially defined';
  return null;
}

function getCogAnalysisSummary(designData: OperationalDesign): string | null {
  const cog = designData.cogAnalysis;
  if (!cog) return null;

  const friendlyLabel = cog.friendly?.root?.label;
  const adversaryLabel = cog.adversary?.root?.label;

  if (!friendlyLabel && !adversaryLabel) return null;

  const parts: string[] = [];
  if (friendlyLabel) parts.push(`Friendly: ${friendlyLabel}`);
  if (adversaryLabel) parts.push(`Adversary: ${adversaryLabel}`);

  const totalNodes =
    countCoGNodes(cog.friendly?.root) + countCoGNodes(cog.adversary?.root);
  parts.push(`${totalNodes} total node${totalNodes !== 1 ? 's' : ''}`);

  return parts.join(' | ');
}

function getLinesOfEffortSummary(designData: OperationalDesign): string | null {
  const loes = designData.linesOfEffort;
  if (!loes || loes.length === 0) return null;

  const totalDPs = loes.reduce(
    (sum, loe) => sum + (loe.decisivePoints?.length ?? 0),
    0
  );
  let cvLinked = 0;
  for (const loe of loes) {
    for (const dp of loe.decisivePoints ?? []) {
      if ((dp.cogLinks ?? []).length > 0) cvLinked++;
    }
  }

  const parts = [
    `${loes.length} LOE${loes.length !== 1 ? 's' : ''}`,
    `${totalDPs} decisive point${totalDPs !== 1 ? 's' : ''}`,
  ];
  if (totalDPs > 0) {
    parts.push(`${cvLinked}/${totalDPs} CoG-linked`);
  }
  return parts.join(', ');
}

function getOperationalApproachSummary(designData: OperationalDesign): string | null {
  const oa = designData.operationalApproach;
  if (!oa) return null;

  const parts: string[] = [];
  const phaseCount = (oa.phases ?? []).length;
  const transitionCount = (oa.transitions ?? []).length;
  const dpCount = (oa.decisionPoints ?? []).length;
  const hasNarrative = (oa.narrative ?? '').trim().length > 0;

  if (phaseCount === 0 && transitionCount === 0 && dpCount === 0 && !hasNarrative) {
    return null;
  }

  if (phaseCount > 0) parts.push(`${phaseCount} phase${phaseCount !== 1 ? 's' : ''}`);
  if (transitionCount > 0)
    parts.push(`${transitionCount} transition${transitionCount !== 1 ? 's' : ''}`);
  if (dpCount > 0)
    parts.push(`${dpCount} decision point${dpCount !== 1 ? 's' : ''}`);
  if (hasNarrative) parts.push('narrative written');

  return parts.join(', ');
}

function getSectionSummary(designData: OperationalDesign, sectionId: string): string | null {
  switch (sectionId) {
    case 'problem-framing':
      return getProblemFramingSummary(designData);
    case 'cog-analysis':
      return getCogAnalysisSummary(designData);
    case 'lines-of-effort':
      return getLinesOfEffortSummary(designData);
    case 'operational-approach':
      return getOperationalApproachSummary(designData);
    default:
      return null;
  }
}

function getEmptyMessage(sectionId: string): string {
  switch (sectionId) {
    case 'problem-framing':
      return 'No problem framing yet';
    case 'cog-analysis':
      return 'No CoG analysis yet';
    case 'lines-of-effort':
      return 'No lines of effort yet';
    case 'operational-approach':
      return 'No operational approach yet';
    default:
      return 'Not started';
  }
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<SectionStatus, string> = {
  'not-started': 'bg-gray-700',
  'in-progress': 'bg-yellow-600',
  complete: 'bg-green-600',
};

function DesignProgressBar({ status }: { status: OperationalDesign['status'] }) {
  const sections = SECTION_CARDS.map((c) => ({
    name: c.name,
    status: status[c.statusKey],
  }));
  const completeCount = sections.filter((s) => s.status === 'complete').length;

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-300">Design Progress</h3>
        <span className="text-sm text-gray-400">
          {completeCount}/{sections.length} sections complete
        </span>
      </div>
      <div className="flex gap-1 h-2 rounded overflow-hidden">
        {sections.map((s) => (
          <div
            key={s.name}
            className={`flex-1 ${STATUS_COLORS[s.status]} transition-colors`}
            title={`${s.name}: ${s.status}`}
          />
        ))}
      </div>
      <div className="flex gap-1 mt-1">
        {sections.map((s) => (
          <span key={s.name} className="flex-1 text-center text-[10px] text-gray-500 truncate">
            {s.name}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function DesignOverview({ designData, onNavigate }: DesignOverviewProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-100 mb-1">Operational Design</h2>
        <p className="text-sm text-gray-400">
          JP 5-0 operational design translates strategic guidance into an operational approach.
          Complete each section to develop a coherent design for your problem set.
        </p>
      </div>

      {/* Progress Bar */}
      <DesignProgressBar status={designData.status} />

      {/* Plan Tab Sync Status */}
      <DesignSyncIndicator status={designData.status} />

      {/* Section Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {SECTION_CARDS.map((card) => {
          const status = designData.status[card.statusKey];
          const summary = getSectionSummary(designData, card.id);

          return (
            <div
              key={card.id}
              className="bg-gray-800 border border-gray-700 rounded-lg p-5 hover:border-gray-600 transition-colors"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-medium text-gray-200">{card.name}</h3>
                <DesignStatusBadge status={status} />
              </div>

              <p className="text-sm text-gray-400 mb-3">{card.description}</p>

              {summary ? (
                <p className="text-sm text-gray-300 bg-gray-900/50 rounded px-3 py-2 mb-3">
                  {summary}
                </p>
              ) : (
                <p className="text-sm text-gray-500 italic bg-gray-900/30 rounded px-3 py-2 mb-3">
                  {getEmptyMessage(card.id)}
                </p>
              )}

              <button
                onClick={() => onNavigate(card.id)}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                Go to Section &rarr;
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
