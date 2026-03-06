/**
 * DesignOverview
 *
 * Phase 25 Plan 01: Dashboard landing page showing all design sections as cards
 * with status, descriptions per JP 5-0, and navigation.
 */

import type { OperationalDesign } from '../../lib/design-service.ts';
import { DesignStatusBadge } from './DesignStatusBadge.tsx';

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

function getSectionSummary(designData: OperationalDesign, sectionId: string): string | null {
  switch (sectionId) {
    case 'problem-framing': {
      const pf = designData.problemFraming;
      if (pf.problemStatement) return pf.problemStatement;
      if (pf.currentState || pf.desiredEndState) return 'Partially defined';
      return null;
    }
    case 'cog-analysis': {
      const cog = designData.cogAnalysis;
      const parts: string[] = [];
      if (cog.friendly?.root) parts.push('Friendly CoG defined');
      if (cog.adversary?.root) parts.push('Adversary CoG defined');
      return parts.length > 0 ? parts.join(', ') : null;
    }
    case 'lines-of-effort': {
      const loes = designData.linesOfEffort;
      if (loes.length === 0) return null;
      const totalDPs = loes.reduce((sum, loe) => sum + (loe.decisivePoints?.length ?? 0), 0);
      return `${loes.length} LOE${loes.length !== 1 ? 's' : ''}, ${totalDPs} decisive point${totalDPs !== 1 ? 's' : ''}`;
    }
    case 'operational-approach': {
      const oa = designData.operationalApproach;
      if (oa.narrative) return oa.narrative.slice(0, 120) + (oa.narrative.length > 120 ? '...' : '');
      if ((oa.phases?.length ?? 0) > 0) return `${oa.phases.length} phase${oa.phases.length !== 1 ? 's' : ''} defined`;
      return null;
    }
    default:
      return null;
  }
}

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTION_CARDS.map(card => {
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

              {summary && (
                <p className="text-sm text-gray-300 bg-gray-900/50 rounded px-3 py-2 mb-3">
                  {summary}
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
