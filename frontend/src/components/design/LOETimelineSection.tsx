/**
 * LOETimelineSection
 *
 * Phase 25 Plan 04: Full Lines of Effort timeline visualization container.
 * Horizontal timeline with phase columns, LOE lanes, decisive points,
 * and CoG vulnerability linkages. Auto-saves with debounce.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  LineOfEffort,
  CoGAnalysis,
  CoGNode,
  LOECoGLink,
  DecisivePoint,
} from '../../lib/design-service.ts';
import { LOELane } from './LOELane.tsx';
import { useIronclawContext } from '../../context/IronclawContext.tsx';

// Suppress unused import warnings — types needed for documentation
void (undefined as unknown as LOECoGLink);
void (undefined as unknown as DecisivePoint);

// ─── Layout Constants ────────────────────────────────────────────────────────

const LANE_HEIGHT = 100;
const PHASE_WIDTH = 200;
const LABEL_WIDTH = 180;
const HEADER_HEIGHT = 50;
const PADDING = 40;

// ─── Types ───────────────────────────────────────────────────────────────────

interface Phase {
  id: string;
  name: string;
}

interface LOETimelineSectionProps {
  problemSetId: string;
  initialLOEs: LineOfEffort[];
  cogAnalysis: CoGAnalysis;
  onUpdate: (loes: LineOfEffort[]) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_PHASES: Phase[] = [
  { id: 'phase-1', name: 'Phase I: Shape' },
  { id: 'phase-2', name: 'Phase II: Deter' },
  { id: 'phase-3', name: 'Phase III: Dominate' },
];

/** Recursively collect all critical-vulnerability nodes from a CoG tree. */
function collectVulnerabilities(node: CoGNode | null): CoGNode[] {
  if (!node) return [];
  const results: CoGNode[] = [];
  if (node.type === 'critical-vulnerability') {
    results.push(node);
  }
  for (const child of node.children) {
    results.push(...collectVulnerabilities(child));
  }
  return results;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function LOETimelineSection({
  problemSetId: _problemSetId,
  initialLOEs,
  cogAnalysis,
  onUpdate,
}: LOETimelineSectionProps) {
  const { sendMessage, toggleDrawer } = useIronclawContext();
  const [loes, setLoes] = useState<LineOfEffort[]>(initialLOEs);
  const [phases, setPhases] = useState<Phase[]>(DEFAULT_PHASES);
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [phaseEditValue, setPhaseEditValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phaseInputRef = useRef<HTMLInputElement>(null);

  // Sync if initialLOEs changes externally
  useEffect(() => {
    setLoes(initialLOEs);
  }, [initialLOEs]);

  // Extract adversary critical vulnerabilities for linking
  const cogVulnerabilities = collectVulnerabilities(cogAnalysis.adversary.root);

  // ─── Auto-save with debounce ─────────────────────────────────────────────

  const scheduleAutoSave = useCallback(
    (data: LineOfEffort[]) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onUpdate(data);
      }, 2000);
    },
    [onUpdate]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const updateLoes = useCallback(
    (newLoes: LineOfEffort[]) => {
      setLoes(newLoes);
      scheduleAutoSave(newLoes);
    },
    [scheduleAutoSave]
  );

  // ─── LOE Management ─────────────────────────────────────────────────────

  const handleAddLOE = () => {
    const newLoe: LineOfEffort = {
      id: crypto.randomUUID(),
      name: `LOE ${loes.length + 1}`,
      description: '',
      decisivePoints: [],
      order: loes.length,
    };
    updateLoes([...loes, newLoe]);
  };

  const handleUpdateLOE = useCallback(
    (updated: LineOfEffort) => {
      const newLoes = loes.map((l) => (l.id === updated.id ? updated : l));
      updateLoes(newLoes);
    },
    [loes, updateLoes]
  );

  const handleDeleteLOE = useCallback(
    (loeId: string) => {
      const newLoes = loes
        .filter((l) => l.id !== loeId)
        .map((l, idx) => ({ ...l, order: idx }));
      updateLoes(newLoes);
    },
    [loes, updateLoes]
  );

  const handleMoveLOE = (loeId: string, direction: 'up' | 'down') => {
    const idx = loes.findIndex((l) => l.id === loeId);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= loes.length) return;
    const newLoes = [...loes];
    [newLoes[idx], newLoes[swapIdx]] = [newLoes[swapIdx], newLoes[idx]];
    updateLoes(newLoes.map((l, i) => ({ ...l, order: i })));
  };

  // ─── Phase Management ────────────────────────────────────────────────────

  const handleAddPhase = () => {
    const newPhase: Phase = {
      id: crypto.randomUUID(),
      name: `Phase ${phases.length + 1}`,
    };
    setPhases([...phases, newPhase]);
  };

  const handleDeletePhase = (phaseId: string) => {
    if (phases.length <= 1) return; // Keep at least 1 phase
    setPhases(phases.filter((p) => p.id !== phaseId));
    // Remove DPs in deleted phase
    const newLoes = loes.map((loe) => ({
      ...loe,
      decisivePoints: loe.decisivePoints.filter((dp) => dp.phase !== phaseId),
    }));
    updateLoes(newLoes);
  };

  const handleStartPhaseEdit = (phase: Phase) => {
    setEditingPhaseId(phase.id);
    setPhaseEditValue(phase.name);
    setTimeout(() => phaseInputRef.current?.focus(), 0);
  };

  const handleSavePhaseEdit = () => {
    if (editingPhaseId && phaseEditValue.trim()) {
      setPhases(
        phases.map((p) =>
          p.id === editingPhaseId ? { ...p, name: phaseEditValue.trim() } : p
        )
      );
    }
    setEditingPhaseId(null);
  };

  // ─── SVG Dimensions ─────────────────────────────────────────────────────

  const svgWidth = LABEL_WIDTH + phases.length * PHASE_WIDTH + PADDING;
  const svgHeight = HEADER_HEIGHT + loes.length * LANE_HEIGHT + PADDING;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden gap-4">
      {/* Section Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">
            Lines of Effort / Operation
          </h2>
          <p className="text-sm text-gray-400">Decisive Points and Phasing</p>
        </div>
        <button
          onClick={() => {
            sendMessage("Analyze: " + JSON.stringify({ loes, cogAnalysis }));
            toggleDrawer();
          }}
          className="px-3 py-1.5 text-xs font-medium rounded bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
        >
          Ask Ironclaw to Analyze
        </button>
      </div>

      <div className="flex gap-0 flex-1 min-h-0">
        {/* Main timeline area */}
        <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
          {/* Phase management bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-medium">Phases:</span>
            {phases.map((phase) => (
              <div
                key={phase.id}
                className="flex items-center gap-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300"
              >
                {editingPhaseId === phase.id ? (
                  <input
                    ref={phaseInputRef}
                    type="text"
                    value={phaseEditValue}
                    onChange={(e) => setPhaseEditValue(e.target.value)}
                    onBlur={handleSavePhaseEdit}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSavePhaseEdit();
                      if (e.key === 'Escape') setEditingPhaseId(null);
                    }}
                    className="bg-gray-700 border border-gray-600 rounded px-1 py-0.5 text-xs text-gray-200 outline-none w-32"
                  />
                ) : (
                  <span
                    onClick={() => handleStartPhaseEdit(phase)}
                    className="cursor-text hover:text-gray-100"
                  >
                    {phase.name}
                  </span>
                )}
                {phases.length > 1 && (
                  <button
                    onClick={() => handleDeletePhase(phase.id)}
                    className="text-gray-500 hover:text-red-400 ml-1"
                    title="Delete phase"
                  >
                    x
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={handleAddPhase}
              className="text-xs text-blue-400 hover:text-blue-300 px-2 py-1 border border-dashed border-gray-600 rounded hover:border-blue-400 transition-colors"
            >
              + Add Phase
            </button>
          </div>

          {/* Timeline SVG */}
          <div
            className="bg-gray-800/30 rounded-lg border border-gray-700 overflow-x-auto"
            style={{ maxWidth: '100%' }}
          >
            <svg
              width={svgWidth}
              height={svgHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              style={{ minWidth: svgWidth }}
            >
              {/* Phase column headers */}
              {phases.map((phase, idx) => {
                const phaseX = LABEL_WIDTH + idx * PHASE_WIDTH;
                return (
                  <g key={`header-${phase.id}`}>
                    {/* Column header background */}
                    <rect
                      x={phaseX}
                      y={0}
                      width={PHASE_WIDTH}
                      height={HEADER_HEIGHT}
                      fill="rgba(17,24,39,0.8)"
                      stroke="#374151"
                      strokeWidth={0.5}
                    />
                    {/* Phase name */}
                    <text
                      x={phaseX + PHASE_WIDTH / 2}
                      y={HEADER_HEIGHT / 2 + 4}
                      textAnchor="middle"
                      fill="#9ca3af"
                      fontSize={12}
                      fontWeight={600}
                    >
                      {phase.name}
                    </text>
                    {/* Vertical divider line */}
                    <line
                      x1={phaseX}
                      y1={0}
                      x2={phaseX}
                      y2={svgHeight}
                      stroke="#374151"
                      strokeWidth={1}
                      strokeDasharray="4 4"
                    />
                  </g>
                );
              })}

              {/* Right edge divider */}
              <line
                x1={LABEL_WIDTH + phases.length * PHASE_WIDTH}
                y1={0}
                x2={LABEL_WIDTH + phases.length * PHASE_WIDTH}
                y2={svgHeight}
                stroke="#374151"
                strokeWidth={1}
                strokeDasharray="4 4"
              />

              {/* Label column header */}
              <rect
                x={0}
                y={0}
                width={LABEL_WIDTH}
                height={HEADER_HEIGHT}
                fill="rgba(17,24,39,0.9)"
                stroke="#374151"
                strokeWidth={0.5}
              />
              <text
                x={LABEL_WIDTH / 2}
                y={HEADER_HEIGHT / 2 + 4}
                textAnchor="middle"
                fill="#6b7280"
                fontSize={11}
                fontWeight={600}
              >
                Lines of Effort
              </text>

              {/* LOE Lanes */}
              {loes.map((loe) => (
                <LOELane
                  key={loe.id}
                  loe={loe}
                  phases={phases}
                  phaseWidth={PHASE_WIDTH}
                  laneHeight={LANE_HEIGHT}
                  labelWidth={LABEL_WIDTH}
                  onLoeUpdate={handleUpdateLOE}
                  onLoeDelete={handleDeleteLOE}
                  cogVulnerabilities={cogVulnerabilities}
                  yOffset={HEADER_HEIGHT + loe.order * LANE_HEIGHT}
                />
              ))}

              {/* Move buttons for LOEs — rendered outside SVG lanes */}
              {loes.map((loe, idx) => {
                const laneY = HEADER_HEIGHT + loe.order * LANE_HEIGHT;
                return (
                  <g key={`move-${loe.id}`}>
                    {idx > 0 && (
                      <g
                        onClick={() => handleMoveLOE(loe.id, 'up')}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={LABEL_WIDTH - 48}
                          y={laneY + LANE_HEIGHT - 22}
                          width={16}
                          height={14}
                          fill="#1f2937"
                          rx={2}
                          stroke="#4b5563"
                          strokeWidth={0.5}
                        />
                        <text
                          x={LABEL_WIDTH - 40}
                          y={laneY + LANE_HEIGHT - 11}
                          textAnchor="middle"
                          fill="#9ca3af"
                          fontSize={10}
                        >
                          ^
                        </text>
                      </g>
                    )}
                    {idx < loes.length - 1 && (
                      <g
                        onClick={() => handleMoveLOE(loe.id, 'down')}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          x={LABEL_WIDTH - 30}
                          y={laneY + LANE_HEIGHT - 22}
                          width={16}
                          height={14}
                          fill="#1f2937"
                          rx={2}
                          stroke="#4b5563"
                          strokeWidth={0.5}
                        />
                        <text
                          x={LABEL_WIDTH - 22}
                          y={laneY + LANE_HEIGHT - 11}
                          textAnchor="middle"
                          fill="#9ca3af"
                          fontSize={10}
                        >
                          v
                        </text>
                      </g>
                    )}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Add LOE button */}
          <button
            onClick={handleAddLOE}
            className="self-start text-sm text-blue-400 hover:text-blue-300 px-3 py-1.5 border border-dashed border-gray-600 rounded hover:border-blue-400 transition-colors"
          >
            + Add Line of Effort
          </button>

          {/* Legend */}
          <div className="flex flex-wrap gap-4 px-3 py-2 bg-gray-800/30 rounded text-xs text-gray-400">
            <div className="flex items-center gap-1.5">
              <svg width={16} height={16}>
                <rect
                  x={3}
                  y={3}
                  width={8}
                  height={8}
                  transform="rotate(45 8 8)"
                  fill="#374151"
                  stroke="#6b7280"
                  strokeWidth={1.5}
                />
              </svg>
              <span>Decisive Point (unlinked)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={16} height={16}>
                <rect
                  x={3}
                  y={3}
                  width={8}
                  height={8}
                  transform="rotate(45 8 8)"
                  fill="#065f46"
                  stroke="#10b981"
                  strokeWidth={1.5}
                />
              </svg>
              <span>Decisive Point (linked to CV)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <svg width={16} height={16}>
                <circle cx={8} cy={8} r={3} fill="#10b981" />
              </svg>
              <span>CoG vulnerability link indicator</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
