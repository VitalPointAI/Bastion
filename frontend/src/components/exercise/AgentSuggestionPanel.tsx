/**
 * AgentSuggestionPanel
 *
 * Phase 15 Plan 05: Collapsible right-side AI suggestion panel for staff product editing.
 *
 * Features:
 *   - Toggle button on the right edge: "AI Assistant" — slides panel open/closed
 *   - On-demand generation: user clicks "Generate Suggestion" to call the backend
 *   - Suggestion blocks: each block has Accept/Reject controls
 *   - Agent team settings sub-panel (gear icon): configure per-role and per-product overrides
 *   - Accepted blocks apply via onApplyBlock callback; rejected blocks grey out
 *
 * Props:
 *   product       — the StaffProduct being edited
 *   scenarioId    — parent scenario
 *   roleKey       — the role creating/editing this product
 *   onApplyBlock  — callback with (blockIndex, content) to apply a block to the editor
 */

import { useState, useEffect, useCallback } from 'react';
import type { StaffProduct, AgentTeamConfig, AgentSuggestion, SuggestionBlock } from '../../types/exercise';
import { exerciseService } from '../../services/exercise-service';
import './AgentSuggestionPanel.css';

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface AgentSuggestionPanelProps {
  product: StaffProduct;
  scenarioId: string;
  roleKey: string;
  onApplyBlock: (blockIndex: number, content: string) => void;
}

// ─── AgentSuggestionPanel ──────────────────────────────────────────────────────

export function AgentSuggestionPanel({
  product,
  scenarioId,
  roleKey,
  onApplyBlock,
}: AgentSuggestionPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [suggestion, setSuggestion] = useState<AgentSuggestion | null>(null);
  const [blockStatuses, setBlockStatuses] = useState<Record<number, SuggestionBlock['status']>>({});
  const [error, setError] = useState<string | null>(null);

  // Agent team settings state
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [agentTeamConfigs, setAgentTeamConfigs] = useState<AgentTeamConfig[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [newAgentTeamId, setNewAgentTeamId] = useState('');
  const [newProductOverride, setNewProductOverride] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  // Load agent team config when panel opens
  const loadAgentConfig = useCallback(async () => {
    setConfigLoading(true);
    setConfigError(null);
    try {
      const configs = await exerciseService.getAgentTeamConfig(scenarioId, roleKey);
      setAgentTeamConfigs(configs);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to load agent config');
    } finally {
      setConfigLoading(false);
    }
  }, [scenarioId, roleKey]);

  useEffect(() => {
    if (isOpen && showAgentSettings) {
      void loadAgentConfig();
    }
  }, [isOpen, showAgentSettings, loadAgentConfig]);

  // Resolve the active agent team config:
  // product-type-specific override > role default
  const activeConfig = agentTeamConfigs.find(
    (c) => c.productType === product.productType
  ) ?? agentTeamConfigs.find(
    (c) => c.productType === null
  ) ?? null;

  // ── Generate suggestion ───────────────────────────────────────────────────

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSuggestion(null);
    setBlockStatuses({});
    try {
      const result = await exerciseService.suggestForProduct(scenarioId, product.id);
      setSuggestion(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate suggestion');
    } finally {
      setIsGenerating(false);
    }
  };

  // ── Block controls ────────────────────────────────────────────────────────

  const handleAcceptBlock = (idx: number, content: string) => {
    setBlockStatuses((prev) => ({ ...prev, [idx]: 'accepted' }));
    onApplyBlock(idx, content);
  };

  const handleRejectBlock = (idx: number) => {
    setBlockStatuses((prev) => ({ ...prev, [idx]: 'rejected' }));
  };

  // ── Save agent team config ────────────────────────────────────────────────

  const handleSaveConfig = async () => {
    if (!newAgentTeamId.trim()) {
      setConfigError('Agent team ID is required');
      return;
    }
    setConfigSaving(true);
    setConfigError(null);
    try {
      await exerciseService.upsertAgentTeamConfig(scenarioId, {
        roleKey,
        productType: newProductOverride ? product.productType : undefined,
        agentTeamId: newAgentTeamId.trim(),
      });
      await loadAgentConfig();
      setNewAgentTeamId('');
      setNewProductOverride(false);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to save config');
    } finally {
      setConfigSaving(false);
    }
  };

  const handleResetToDefault = async (configId: string) => {
    try {
      await exerciseService.deleteAgentTeamConfig(scenarioId, configId);
      await loadAgentConfig();
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : 'Failed to reset config');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className={`asp-wrapper ${isOpen ? 'asp-wrapper--open' : ''}`}>
      {/* ── Toggle button ── */}
      <button
        className="asp-toggle-btn"
        onClick={() => setIsOpen((o) => !o)}
        title={isOpen ? 'Close AI Assistant' : 'Open AI Assistant'}
        aria-expanded={isOpen}
        aria-label="AI Assistant panel"
      >
        <span className="asp-toggle-label">AI</span>
      </button>

      {/* ── Slide-in panel ── */}
      {isOpen && (
        <div className="asp-panel" role="complementary" aria-label="AI suggestion panel">
          {/* Header */}
          <div className="asp-header">
            <div className="asp-header-left">
              <span className="asp-header-title">AI Suggestion</span>
              <span className="asp-product-label">
                {product.productType.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="asp-header-actions">
              <button
                className={`asp-gear-btn ${showAgentSettings ? 'asp-gear-btn--active' : ''}`}
                onClick={() => setShowAgentSettings((s) => !s)}
                title="Agent team settings"
                aria-label="Agent team settings"
              >
                &#9881;
              </button>
              <button
                className="asp-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close panel"
                aria-label="Close AI suggestion panel"
              >
                &times;
              </button>
            </div>
          </div>

          {/* ── Agent Team Settings (collapsible) ── */}
          {showAgentSettings && (
            <div className="asp-settings">
              <div className="asp-settings-title">Agent Team Settings</div>
              {configLoading ? (
                <p className="asp-settings-loading">Loading config...</p>
              ) : (
                <>
                  {/* Current config display */}
                  <div className="asp-config-status">
                    {activeConfig ? (
                      <span className="asp-config-active">
                        Using: <strong>{activeConfig.agentTeamId}</strong>
                        {activeConfig.productType
                          ? ` (${product.productType} override)`
                          : ' (role default)'}
                      </span>
                    ) : (
                      <span className="asp-config-default">Using: system default</span>
                    )}
                  </div>

                  {/* Reset product override link */}
                  {agentTeamConfigs.some((c) => c.productType === product.productType) && (
                    <button
                      className="asp-reset-link"
                      onClick={() => {
                        const override = agentTeamConfigs.find(
                          (c) => c.productType === product.productType
                        );
                        if (override) void handleResetToDefault(override.id);
                      }}
                    >
                      Reset to Role Default
                    </button>
                  )}

                  {/* Set new config */}
                  <div className="asp-config-form">
                    <label className="asp-config-label">Agent Team ID</label>
                    <input
                      className="asp-config-input"
                      type="text"
                      value={newAgentTeamId}
                      onChange={(e) => setNewAgentTeamId(e.target.value)}
                      placeholder="e.g. team-alpha"
                    />
                    <label className="asp-config-checkbox-row">
                      <input
                        type="checkbox"
                        checked={newProductOverride}
                        onChange={(e) => setNewProductOverride(e.target.checked)}
                      />
                      <span>Override for this product type only</span>
                    </label>
                    <button
                      className="asp-config-save-btn"
                      onClick={handleSaveConfig}
                      disabled={configSaving || !newAgentTeamId.trim()}
                    >
                      {configSaving ? 'Saving...' : 'Save'}
                    </button>
                  </div>

                  {configError && <p className="asp-settings-error">{configError}</p>}
                </>
              )}
            </div>
          )}

          {/* ── Generate button ── */}
          <div className="asp-generate-section">
            <button
              className="asp-generate-btn"
              onClick={handleGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? 'Analyzing...' : suggestion ? 'Regenerate' : 'Generate Suggestion'}
            </button>
            {isGenerating && (
              <div className="asp-spinner-row">
                <span className="asp-spinner" aria-hidden="true" />
                <span className="asp-spinner-text">
                  Analyzing {product.productType.replace(/_/g, ' ')}...
                </span>
              </div>
            )}
          </div>

          {/* ── Error ── */}
          {error && <div className="asp-error">{error}</div>}

          {/* ── Suggestion blocks ── */}
          <div className="asp-blocks">
            {!suggestion && !isGenerating && (
              <div className="asp-empty">
                <p>Click &apos;Generate Suggestion&apos; to get AI-assisted content for this product.</p>
              </div>
            )}

            {suggestion && suggestion.blocks.map((block, idx) => {
              const status = blockStatuses[idx] ?? block.status;
              return (
                <div
                  key={block.id}
                  className={`asp-block asp-block--${status}`}
                >
                  <div className="asp-block-header">
                    {block.type === 'structured_field' && block.fieldName && (
                      <span className="asp-block-field">{block.fieldName}</span>
                    )}
                    {block.type === 'narrative' && (
                      <span className="asp-block-type">Narrative</span>
                    )}
                    <div className="asp-block-status-icon">
                      {status === 'accepted' && (
                        <span className="asp-icon asp-icon--accepted" title="Accepted">&#10003;</span>
                      )}
                      {status === 'rejected' && (
                        <span className="asp-icon asp-icon--rejected" title="Rejected">&#10007;</span>
                      )}
                    </div>
                  </div>
                  <div className={`asp-block-content ${status === 'rejected' ? 'asp-block-content--rejected' : ''}`}>
                    {block.content}
                  </div>
                  {status === 'pending' && (
                    <div className="asp-block-actions">
                      <button
                        className="asp-block-btn asp-block-btn--accept"
                        onClick={() => handleAcceptBlock(idx, block.content)}
                        title="Apply this suggestion to the product editor"
                      >
                        Accept
                      </button>
                      <button
                        className="asp-block-btn asp-block-btn--reject"
                        onClick={() => handleRejectBlock(idx)}
                        title="Dismiss this suggestion"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
