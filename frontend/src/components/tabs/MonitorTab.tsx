import { useState, useEffect } from 'react';
import { TabLayout, type SidebarItem } from './TabLayout.js';
import { StrategicValidityDashboard } from '../validity/index.js';
import { GraphExplorer, type GraphData } from '../graph/GraphExplorer.js';
import { NodeDetailPanel } from '../graph/NodeDetailPanel.js';

type MonitorView = 'validity-dashboard' | 'actor-graph' | 'actor-detail';

const MONITOR_ITEMS: SidebarItem[] = [
  { id: 'validity-dashboard', label: 'IPB Map' },
  {
    id: 'actor-graph',
    label: 'Actor Graph',
    tooltip: 'Relationship network — Intelligence Preparation of the Battlefield',
  },
  {
    id: 'actor-detail',
    label: 'Actor Detail',
    tooltip: 'Detailed actor profile with relationships and tensions',
  },
];

interface MonitorTabProps {
  workspaceId: string;
}

export function MonitorTab({ workspaceId }: MonitorTabProps) {
  const [selectedView, setSelectedView] = useState<MonitorView>('validity-dashboard');
  const [selectedActorId, setSelectedActorId] = useState<string | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  useEffect(() => {
    fetch(`/api/graph?workspaceId=${workspaceId}`)
      .then(res => {
        if (!res.ok) return null;
        return res.json() as Promise<GraphData>;
      })
      .then(data => {
        if (data) setGraphData(data);
      })
      .catch(() => {
        // Graph data unavailable — will show loading message
      });
  }, [workspaceId]);

  return (
    <TabLayout
      items={MONITOR_ITEMS}
      selectedItem={selectedView}
      onSelectItem={(id) => setSelectedView(id as MonitorView)}
    >
      {selectedView === 'validity-dashboard' && <StrategicValidityDashboard />}
      {selectedView === 'actor-graph' && (
        graphData === null
          ? <div className="tab-placeholder"><p>Loading graph data...</p></div>
          : (
            <GraphExplorer
              data={graphData}
              workspaceId={workspaceId}
              onNodeClick={(node) => {
                setSelectedActorId(node.id);
                setSelectedView('actor-detail');
              }}
              selectedNodeId={selectedActorId ?? undefined}
            />
          )
      )}
      {selectedView === 'actor-detail' && (
        <NodeDetailPanel
          actorId={selectedActorId}
          onClose={() => setSelectedView('actor-graph')}
          onNavigateToActor={(id) => setSelectedActorId(id)}
        />
      )}
    </TabLayout>
  );
}
