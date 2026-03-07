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
import { ProblemFramingSection } from '../design/ProblemFramingSection.tsx';
import { CoGAnalysisSection } from '../design/CoGAnalysisSection.tsx';
import { LOETimelineSection } from '../design/LOETimelineSection.tsx';
import { OperationalApproachSection } from '../design/OperationalApproachSection.tsx';
import type { ProblemFramingData, CoGAnalysis, LineOfEffort, OperationalApproach } from '../../lib/design-service.ts';
import { DecisionGateBanner, GateSubmitButton, DecisionGateTimeline } from '../governance/index.ts';
import type { DecisionGate } from '../../lib/gate-service';

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

export function DesignTab({ problemSetId }: DesignTabProps) {
  const [selectedView, setSelectedView] = useState<DesignView>('overview');
  const [designData, setDesignData] = useState<OperationalDesign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_selectedGate, setSelectedGate] = useState<DecisionGate | null>(null);

  const handleGateDetailClick = useCallback((gate: DecisionGate) => {
    setSelectedGate(gate);
    console.log('[DesignTab] Gate detail:', gate.id, gate.gate_type, gate.status);
  }, []);

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
      decisionHistory={
        <DecisionGateTimeline tabId="design" onEntryClick={handleGateDetailClick} />
      }
    >
      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="design" />

      {selectedView === 'overview' && designData && (
        <DesignOverview
          designData={designData}
          onNavigate={(view) => setSelectedView(view as DesignView)}
        />
      )}

      {selectedView === 'problem-framing' && designData && (
        <ProblemFramingSection
          problemSetId={problemSetId}
          initialData={designData.problemFraming}
          onUpdate={(data: ProblemFramingData) => handleSectionUpdate('problem-framing', data)}
        />
      )}

      {selectedView === 'cog-analysis' && designData && (
        <CoGAnalysisSection
          problemSetId={problemSetId}
          initialData={designData.cogAnalysis}
          onUpdate={(data: CoGAnalysis) => handleSectionUpdate('cog-analysis', data)}
        />
      )}

      {selectedView === 'lines-of-effort' && designData && (
        <LOETimelineSection
          problemSetId={problemSetId}
          initialLOEs={designData.linesOfEffort}
          cogAnalysis={designData.cogAnalysis}
          onUpdate={(loes: LineOfEffort[]) => handleSectionUpdate('lines-of-effort', loes)}
        />
      )}

      {selectedView === 'operational-approach' && designData && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <span />
            <GateSubmitButton
              gateType="operational_approach"
              itemId={`${problemSetId}-operational-approach`}
              itemTitle="Operational Approach"
              itemDescription="Submit operational approach for approval"
              tabId="design"
            />
          </div>
          <OperationalApproachSection
            problemSetId={problemSetId}
            initialData={designData.operationalApproach}
            designData={designData}
            onUpdate={(data: OperationalApproach) => handleSectionUpdate('operational-approach', data)}
          />
        </div>
      )}
    </TabLayout>
  );
}
