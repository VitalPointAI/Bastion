/**
 * EWMOverview
 *
 * Phase 33 Plan 08: Container component for E-W-M tab in Plan sidebar.
 * Toggles between interactive Tree View and analytical Sankey View.
 * Displays summary bar and gap analysis panel.
 */

import { useState, useEffect, useCallback } from 'react';
import { ewmService } from '../../lib/ewm-service.ts';
import type { EWMLinkage, EWMGap, EWMSummary } from '../../lib/ewm-service.ts';
import { EWMTree } from './EWMTree.tsx';
import type { EWMEnd, EWMWay, EWMMean } from './EWMTree.tsx';
import { EWMSankey } from './EWMSankey.tsx';

// ─── Gap Color Coding ────────────────────────────────────────────────────────

const GAP_COLORS: Record<EWMGap['type'], { bg: string; border: string; text: string; label: string }> = {
  unlinked_end: { bg: 'bg-red-900/30', border: 'border-red-700', text: 'text-red-300', label: 'Unlinked Objective' },
  unsupported_way: { bg: 'bg-orange-900/30', border: 'border-orange-700', text: 'text-orange-300', label: 'Unsupported LOE/COA' },
  unallocated_mean: { bg: 'bg-gray-800/50', border: 'border-gray-600', text: 'text-gray-400', label: 'Orphan Force/Resource' },
  over_allocated_mean: { bg: 'bg-yellow-900/30', border: 'border-yellow-700', text: 'text-yellow-300', label: 'Over-allocated' },
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface EWMOverviewProps {
  problemSetId: string;
  jppInstanceId: string;
  currentRole: string;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function EWMOverview({ problemSetId, jppInstanceId, currentRole }: EWMOverviewProps) {
  const [view, setView] = useState<'tree' | 'sankey'>('tree');
  const [gapsPanelOpen, setGapsPanelOpen] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data state
  const [linkages, setLinkages] = useState<EWMLinkage[]>([]);
  const [gaps, setGaps] = useState<EWMGap[]>([]);
  const [summary, setSummary] = useState<EWMSummary | null>(null);

  // Derived entity arrays from summary
  const [ends, setEnds] = useState<EWMEnd[]>([]);
  const [ways, setWays] = useState<EWMWay[]>([]);
  const [means, setMeans] = useState<EWMMean[]>([]);

  // ─── Data Fetching ──────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [linkagesData, gapsData, summaryData] = await Promise.all([
        ewmService.getLinkages(jppInstanceId),
        ewmService.getGaps(jppInstanceId),
        ewmService.getSummary(jppInstanceId),
      ]);

      setLinkages(linkagesData);
      setGaps(gapsData);
      setSummary(summaryData);

      // Build ends from summary items (strategic objectives)
      setEnds(
        summaryData.ends.items.map((item) => ({
          id: item.id,
          description: item.name,
          priority: 'MEDIUM' as const, // Default; backend would provide actual priority
        })),
      );

      // Build ways from summary items (LOEs/COAs)
      setWays(
        summaryData.ways.items.map((item) => ({
          id: item.id,
          name: item.name,
          // Infer type from linkages or default to 'loe'
          type: (linkagesData.find((l) => l.wayId === item.id)?.wayType ?? 'loe') as 'loe' | 'coa',
        })),
      );

      // Build means from summary items (Forces/Resources)
      setMeans(
        summaryData.means.items.map((item) => ({
          id: item.id,
          name: item.name,
          type: 'force' as const, // Default; backend would provide actual type
        })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load E-W-M data');
    } finally {
      setLoading(false);
    }
  }, [jppInstanceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ─── Linkage Handlers ─────────────────────────────────────────────────

  const handleCreateLinkage = useCallback(
    async (endId: string, wayId: string, wayType: string) => {
      try {
        await ewmService.createLinkage(jppInstanceId, {
          endObjectiveId: endId,
          wayId,
          wayType: wayType as 'loe' | 'coa',
        });
        await fetchData();
      } catch (err) {
        console.error('Failed to create linkage:', err);
      }
    },
    [jppInstanceId, fetchData],
  );

  const handleDeleteLinkage = useCallback(
    async (linkageId: string) => {
      try {
        await ewmService.deleteLinkage(jppInstanceId, linkageId);
        await fetchData();
      } catch (err) {
        console.error('Failed to delete linkage:', err);
      }
    },
    [jppInstanceId, fetchData],
  );

  const handleUpdateAllocation = useCallback(
    async (linkageId: string, pct: number) => {
      try {
        await ewmService.updateAllocation(jppInstanceId, linkageId, pct);
        await fetchData();
      } catch (err) {
        console.error('Failed to update allocation:', err);
      }
    },
    [jppInstanceId, fetchData],
  );

  // ─── Computed read-only based on role ─────────────────────────────────

  const readOnly = !currentRole || currentRole === 'observer';

  // ─── Loading / Error States ───────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-400">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-gray-500 border-t-blue-400 rounded-full animate-spin" />
          <span className="text-sm">Loading E-W-M data...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-2">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={() => { setLoading(true); fetchData(); }}
          className="text-xs text-blue-400 hover:text-blue-300 underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Summary Bar ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-3 py-2 bg-gray-800/50 border-b border-gray-700 text-xs">
        <span className="text-red-400 font-medium">{summary?.ends.count ?? 0} Objectives</span>
        <span className="text-gray-600">|</span>
        <span className="text-blue-400 font-medium">{summary?.ways.count ?? 0} LOEs/COAs</span>
        <span className="text-gray-600">|</span>
        <span className="text-green-400 font-medium">{summary?.means.count ?? 0} Forces</span>
        <span className="text-gray-600">|</span>
        <span className={`font-medium ${gaps.length > 0 ? 'text-amber-400' : 'text-gray-500'}`}>
          {gaps.length} Gap{gaps.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── View Toggle ────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-700">
        <button
          onClick={() => setView('tree')}
          className={`px-3 py-1 text-xs rounded ${
            view === 'tree'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Tree View
        </button>
        <button
          onClick={() => setView('sankey')}
          className={`px-3 py-1 text-xs rounded ${
            view === 'sankey'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Sankey View
        </button>

        <div className="flex-1" />

        <button
          onClick={() => setGapsPanelOpen(!gapsPanelOpen)}
          className="flex items-center gap-1 px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
        >
          <span className={`w-2 h-2 rounded-full ${gaps.length > 0 ? 'bg-amber-400' : 'bg-gray-500'}`} />
          Gaps {gapsPanelOpen ? '\u25B2' : '\u25BC'}
        </button>
      </div>

      {/* ── Main Content Area ──────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* Visualization */}
        <div className="flex-1 overflow-auto p-3">
          {view === 'tree' ? (
            <EWMTree
              jppInstanceId={jppInstanceId}
              problemSetId={problemSetId}
              ends={ends}
              ways={ways}
              means={means}
              linkages={linkages}
              gaps={gaps}
              onCreateLinkage={handleCreateLinkage}
              onDeleteLinkage={handleDeleteLinkage}
              onUpdateAllocation={handleUpdateAllocation}
              readOnly={readOnly}
            />
          ) : (
            <EWMSankey
              ends={ends}
              ways={ways}
              means={means}
              linkages={linkages}
            />
          )}
        </div>

        {/* ── Gap Analysis Panel ─────────────────────────────────────── */}
        {gapsPanelOpen && (
          <div className="w-64 border-l border-gray-700 overflow-y-auto bg-gray-900/50 shrink-0">
            <div className="px-3 py-2 border-b border-gray-700">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wide">Gap Analysis</h3>
            </div>

            {gaps.length === 0 ? (
              <div className="px-3 py-4 text-center">
                <p className="text-xs text-gray-500">No gaps detected</p>
                <p className="text-[10px] text-gray-600 mt-1">All entities are properly linked</p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5 p-2">
                {gaps.map((gap, idx) => {
                  const style = GAP_COLORS[gap.type];
                  return (
                    <div
                      key={`${gap.entityId}-${idx}`}
                      className={`${style.bg} border ${style.border} rounded p-2`}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className={`text-[9px] font-bold uppercase ${style.text}`}>
                          {style.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-300 font-medium">{gap.entityName}</p>
                      <p className="text-[10px] text-gray-400 mt-0.5">{gap.details}</p>
                    </div>
                  );
                })}

                {/* AI Suggestion placeholder */}
                <button
                  className="mt-2 w-full px-2 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-600 border-dashed rounded text-gray-400 hover:text-gray-300"
                  onClick={() => {
                    // Placeholder for AI agent integration
                    console.log('AI suggestion requested for E-W-M gaps');
                  }}
                >
                  Suggest Fixes (AI)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
