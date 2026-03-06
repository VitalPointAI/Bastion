/**
 * DesignTab
 *
 * Phase 25 Plan 01: TabLayout-based Design tab with sidebar navigation,
 * status badges, and overview dashboard. Replaces DoctrinalPlaceholder.
 */

import { useState, useEffect, useCallback } from 'react';
import { TabLayout } from './TabLayout.tsx';
import type { SidebarItem } from './TabLayout.tsx';
import { designService } from '../../lib/design-service.ts';
import type { OperationalDesign, SectionStatus } from '../../lib/design-service.ts';
import { DesignOverview } from '../design/DesignOverview.tsx';

type DesignView = 'overview' | 'problem-framing' | 'cog-analysis' | 'lines-of-effort' | 'operational-approach';

interface DesignTabProps {
  problemSetId: string;
}

function buildSidebarItems(status?: OperationalDesign['status']): SidebarItem[] {
  const getStatus = (key: keyof OperationalDesign['status']): SectionStatus | undefined =>
    status?.[key];

  return [
    { id: 'overview', label: 'Overview' },
    { id: 'problem-framing', label: 'Problem Framing', status: getStatus('problemFraming') },
    { id: 'cog-analysis', label: 'CoG Analysis', status: getStatus('cogAnalysis') },
    { id: 'lines-of-effort', label: 'Lines of Effort', status: getStatus('linesOfEffort') },
    { id: 'operational-approach', label: 'Operational Approach', status: getStatus('operationalApproach') },
  ];
}

const SECTION_PLAN_MAP: Record<string, string> = {
  'problem-framing': 'Plan 02',
  'cog-analysis': 'Plan 03',
  'lines-of-effort': 'Plan 03',
  'operational-approach': 'Plan 04',
};

export function DesignTab({ problemSetId }: DesignTabProps) {
  const [selectedView, setSelectedView] = useState<DesignView>('overview');
  const [designData, setDesignData] = useState<OperationalDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDesign = useCallback(async () => {
    try {
      setError(null);
      const data = await designService.getDesign(problemSetId);
      setDesignData(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load design';
      setError(message);
      console.error('[DesignTab] Failed to load design:', message);
    } finally {
      setLoading(false);
    }
  }, [problemSetId]);

  useEffect(() => {
    loadDesign();
  }, [loadDesign]);

  const handleSectionUpdate = useCallback(async (section: string, data: unknown) => {
    try {
      const updated = await designService.updateSection(problemSetId, section, data);
      setDesignData(updated);
    } catch (err) {
      console.error('[DesignTab] Failed to update section:', err);
    }
  }, [problemSetId]);

  // Keep handleSectionUpdate available for future section components
  void handleSectionUpdate;

  const sidebarItems = buildSidebarItems(designData?.status);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        Loading operational design...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-3">
        <p className="text-red-400">Error: {error}</p>
        <button
          onClick={loadDesign}
          className="text-sm text-blue-400 hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <TabLayout
      items={sidebarItems}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as DesignView)}
    >
      {selectedView === 'overview' && designData && (
        <DesignOverview
          designData={designData}
          onNavigate={(view) => setSelectedView(view as DesignView)}
        />
      )}

      {selectedView !== 'overview' && (
        <div className="flex flex-col items-center justify-center h-64 text-gray-400 gap-2">
          <h3 className="text-lg font-medium text-gray-300">
            {sidebarItems.find(i => i.id === selectedView)?.label ?? selectedView}
          </h3>
          <p className="text-sm">
            Coming in {SECTION_PLAN_MAP[selectedView] ?? 'a future plan'}
          </p>
        </div>
      )}
    </TabLayout>
  );
}
