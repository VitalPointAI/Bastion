import { useState, useCallback, useEffect } from 'react';
import { BrainController } from '../brain/BrainController.js';
import { InheritedContextSection } from '../inheritance/InheritedContextSection.tsx';
import { DecisionGateBanner } from '../governance/index.js';
import { TabLayout } from './TabLayout.tsx';
import type { SidebarItem } from './TabLayout.tsx';
import { ObjectivesReviewPage } from '../understand/ObjectivesReviewPage.tsx';
import { ScopingInterview } from '../doc-intelligence/ScopingInterview.tsx';

type UnderstandView = 'scoping' | 'brain' | 'objectives';

interface UnderstandTabProps {
  problemSetId: string;
}

const API_BASE = import.meta.env.VITE_API_URL || '';

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  const [selectedView, setSelectedView] = useState<UnderstandView>('brain');
  const [draftCount, setDraftCount] = useState(0);
  const [hasContext, setHasContext] = useState(false);
  const [showInterview, setShowInterview] = useState(false);

  const handleDraftCountChange = useCallback((count: number) => {
    setDraftCount(count);
  }, []);

  // Check if scoping context already exists
  useEffect(() => {
    let cancelled = false;
    async function checkContext() {
      try {
        const res = await fetch(`${API_BASE}/api/doc-intelligence/context/${encodeURIComponent(problemSetId)}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.success && data.context) setHasContext(true);
      } catch { /* best-effort */ }
    }
    checkContext();
    return () => { cancelled = true; };
  }, [problemSetId]);

  const sidebarItems: SidebarItem[] = [
    { id: 'scoping', label: hasContext ? 'Scoping \u2713' : 'Scoping' },
    { id: 'brain', label: 'Brain' },
    {
      id: 'objectives',
      label: draftCount > 0 ? `Objectives (${draftCount})` : 'Objectives',
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Inherited context from parent problem sets */}
      {problemSetId && (
        <InheritedContextSection problemSetId={problemSetId} />
      )}

      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="understand" />

      {/* Content area with sidebar navigation */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
        <TabLayout
          items={sidebarItems}
          selectedItem={selectedView}
          onSelectItem={(id) => setSelectedView(id as UnderstandView)}
        >
          {selectedView === 'scoping' && (
            <div style={{ padding: '1.5rem', maxWidth: '40rem' }}>
              <div style={{
                background: '#0d1117',
                border: '1px solid #21262d',
                borderRadius: '0.75rem',
                padding: '1.5rem',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      width: '1.75rem', height: '1.75rem', borderRadius: '0.5rem',
                      background: 'linear-gradient(135deg, #1e3a5f 0%, #0d1117 100%)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', color: '#e6edf3',
                    }}>
                      {hasContext ? '\u2713' : '\u2699'}
                    </div>
                    <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#e6edf3', margin: 0 }}>
                      Problem Set Scoping
                    </h3>
                  </div>
                  {hasContext && (
                    <span style={{
                      fontSize: '0.6875rem', fontWeight: 600, padding: '0.125rem 0.5rem',
                      borderRadius: '1rem', color: '#3fb950',
                      background: 'rgba(63, 185, 80, 0.1)', border: '1px solid rgba(63, 185, 80, 0.25)',
                    }}>
                      CONFIGURED
                    </span>
                  )}
                </div>

                <p style={{ fontSize: '0.8125rem', color: '#8b949e', marginBottom: '1rem', lineHeight: 1.5 }}>
                  {hasContext
                    ? 'Intelligence analysis is scoped to your defined parameters. Re-run to update.'
                    : 'Define geographic scope, temporal range, actor focus, and core problem before uploading documents.'}
                </p>

                <button
                  onClick={() => setShowInterview(true)}
                  style={hasContext
                    ? { padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '0.375rem', cursor: 'pointer', background: 'transparent', color: '#58a6ff', border: '1px solid #30363d' }
                    : { padding: '0.5rem 1rem', fontSize: '0.8125rem', fontWeight: 500, borderRadius: '0.375rem', cursor: 'pointer', background: '#1f6feb', color: '#ffffff', border: '1px solid #1f6feb' }
                  }
                >
                  {hasContext ? 'Re-run Interview' : 'Start Scoping Interview'}
                </button>
              </div>

              {/* Scoping Interview Modal */}
              {showInterview && (
                <div style={{
                  position: 'fixed', inset: 0, zIndex: 50,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  paddingTop: '3.5rem',
                  background: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(4px)',
                }}>
                  <div style={{
                    width: '100%', maxWidth: '48rem', maxHeight: 'calc(100vh - 5rem)', height: '80vh',
                    background: '#0d1117', borderRadius: '0.75rem', border: '1px solid #21262d',
                    overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                  }}>
                    <ScopingInterview
                      problemSetId={problemSetId}
                      onComplete={() => { setShowInterview(false); setHasContext(true); }}
                      onClose={() => setShowInterview(false)}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {selectedView === 'brain' && (
            <div style={{ height: '100%', position: 'relative' }}>
              <BrainController problemSetId={problemSetId} />
            </div>
          )}

          {selectedView === 'objectives' && (
            <ObjectivesReviewPage
              problemSetId={problemSetId}
              onDraftCountChange={handleDraftCountChange}
            />
          )}
        </TabLayout>
      </div>
    </div>
  );
}
