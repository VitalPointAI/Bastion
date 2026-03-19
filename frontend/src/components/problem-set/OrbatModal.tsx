/**
 * OrbatModal — Interactive ORBAT Editor
 *
 * Drag-and-drop organizational chart for problem set members.
 * - Nodes can be repositioned by dragging
 * - Connect members by dragging from a node's connector handle to another node
 * - Solid lines = direct report, dotted lines = coordination/soft report
 * - Toggle line type with a toolbar selector
 * - Persists layout and relationships via API
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type { ProblemSetMemberDetail } from '../../lib/problem-set-service';
import { problemSetService } from '../../lib/problem-set-service';
import { useUser } from '../../context/UserContext';

// ─── Types ──────────────────────────────────────────────────────────────────

interface OrbatModalProps {
  members: ProblemSetMemberDetail[];
  problemSetId: string;
  onClose: () => void;
  onSelectMember?: (member: ProblemSetMemberDetail) => void;
}

interface NodePosition {
  x: number;
  y: number;
}

interface Edge {
  from: string; // superior DID
  to: string;   // subordinate DID
  type: 'direct' | 'dotted';
}

type EdgeMode = 'direct' | 'dotted';

// ─── Constants ──────────────────────────────────────────────────────────────

const NODE_W = 140;
const NODE_H = 64;

const ROLE_TIERS: Record<string, number> = {
  commander: 0, xo: 1, team_lead: 1,
  s1: 2, s2: 2, s3: 2, s4: 2, s5: 2, s6: 2, s7: 2, s8: 2, s9: 2,
  member: 3, observer: 4,
};

const ROLE_LABELS: Record<string, string> = {
  commander: 'CDR', xo: 'XO', team_lead: 'TL',
  s1: 'S1', s2: 'S2', s3: 'S3', s4: 'S4', s5: 'S5', s6: 'S6', s7: 'S7', s8: 'S8', s9: 'S9',
  member: 'MBR', observer: 'OBS',
};

const TIER_COLORS: Record<number, { bg: string; border: string; text: string; fill: string }> = {
  0: { bg: 'bg-yellow-900/40', border: 'border-yellow-700', text: 'text-yellow-300', fill: '#854d0e' },
  1: { bg: 'bg-blue-900/40', border: 'border-blue-700', text: 'text-blue-300', fill: '#1e3a5f' },
  2: { bg: 'bg-indigo-900/40', border: 'border-indigo-700', text: 'text-indigo-300', fill: '#312e81' },
  3: { bg: 'bg-gray-800', border: 'border-gray-600', text: 'text-gray-300', fill: '#1f2937' },
  4: { bg: 'bg-gray-800/50', border: 'border-gray-700', text: 'text-gray-500', fill: '#111827' },
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function getTier(role: string): number {
  return ROLE_TIERS[role.toLowerCase()] ?? 3;
}

function getRoleLabel(role: string): string {
  return ROLE_LABELS[role.toLowerCase()] ?? role.toUpperCase().slice(0, 3);
}

function shortenDid(did: string): string {
  if (did.startsWith('did:near:')) {
    const acct = did.replace('did:near:', '');
    return acct.length > 14 ? acct.slice(0, 6) + '..' + acct.slice(-5) : acct;
  }
  return did.length > 16 ? did.slice(0, 8) + '..' + did.slice(-6) : did;
}

function buildInitialPositions(members: ProblemSetMemberDetail[]): Record<string, NodePosition> {
  // Group by tier, then lay out horizontally centered
  const tiers = new Map<number, ProblemSetMemberDetail[]>();
  for (const m of members) {
    const tier = getTier(m.role);
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier)!.push(m);
  }

  const sorted = [...tiers.entries()].sort(([a], [b]) => a - b);
  const positions: Record<string, NodePosition> = {};
  const hGap = NODE_W + 24;
  const vGap = NODE_H + 60;

  sorted.forEach(([, tierMembers], tierIdx) => {
    const totalW = tierMembers.length * hGap - 24;
    const startX = Math.max(40, (900 - totalW) / 2);
    tierMembers.forEach((m, i) => {
      positions[m.userDid] = {
        x: startX + i * hGap,
        y: 40 + tierIdx * vGap,
      };
    });
  });

  return positions;
}

// ─── Component ──────────────────────────────────────────────────────────────

export function OrbatModal({ members, problemSetId, onClose, onSelectMember }: OrbatModalProps) {
  const { userDID } = useUser();
  const canvasRef = useRef<HTMLDivElement>(null);

  // Node positions
  const [positions, setPositions] = useState<Record<string, NodePosition>>(() =>
    buildInitialPositions(members),
  );

  // Edges (reporting relationships)
  const [edges, setEdges] = useState<Edge[]>([]);
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('direct');

  // Dragging state
  const [dragging, setDragging] = useState<{ did: string; offsetX: number; offsetY: number } | null>(null);

  // Edge-drawing state (drag from connector dot)
  const [drawingEdge, setDrawingEdge] = useState<{ from: string; mouseX: number; mouseY: number } | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  // Load existing relationships
  useEffect(() => {
    problemSetService.getReportingRelationships(problemSetId).then((rels) => {
      setEdges(
        rels.map((r) => ({
          from: r.superior_did,
          to: r.subordinate_did,
          type: r.relationship_type,
        })),
      );
    }).catch(() => {});
  }, [problemSetId]);

  // ─── Node dragging ──────────────────────────────────────────────────────

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, did: string) => {
      // Right-click or if we're starting an edge draw, skip node drag
      if (e.button !== 0) return;
      const pos = positions[did];
      if (!pos) return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      e.stopPropagation();
      setDragging({
        did,
        offsetX: e.clientX - rect.left - pos.x,
        offsetY: e.clientY - rect.top - pos.y,
      });
    },
    [positions],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      if (dragging) {
        const x = Math.max(0, e.clientX - rect.left - dragging.offsetX);
        const y = Math.max(0, e.clientY - rect.top - dragging.offsetY);
        setPositions((prev) => ({ ...prev, [dragging.did]: { x, y } }));
      }

      if (drawingEdge) {
        setDrawingEdge((prev) =>
          prev ? { ...prev, mouseX: e.clientX - rect.left, mouseY: e.clientY - rect.top } : null,
        );
      }
    },
    [dragging, drawingEdge],
  );

  const handleMouseUp = useCallback(
    (e: React.MouseEvent) => {
      if (dragging) {
        setDragging(null);
        return;
      }

      if (drawingEdge) {
        // Find if we're dropping on a node
        const rect = canvasRef.current?.getBoundingClientRect();
        if (rect) {
          const mx = e.clientX - rect.left;
          const my = e.clientY - rect.top;
          for (const m of members) {
            const pos = positions[m.userDid];
            if (!pos) continue;
            if (
              mx >= pos.x && mx <= pos.x + NODE_W &&
              my >= pos.y && my <= pos.y + NODE_H &&
              m.userDid !== drawingEdge.from
            ) {
              // Create edge
              const newEdge: Edge = { from: drawingEdge.from, to: m.userDid, type: edgeMode };
              // Check for duplicate
              const exists = edges.some(
                (e2) => e2.from === newEdge.from && e2.to === newEdge.to && e2.type === newEdge.type,
              );
              if (!exists) {
                setEdges((prev) => [...prev, newEdge]);
                setDirty(true);
              }
              break;
            }
          }
        }
        setDrawingEdge(null);
      }
    },
    [dragging, drawingEdge, edgeMode, edges, members, positions],
  );

  // ─── Edge connector handle drag ────────────────────────────────────────

  const handleConnectorMouseDown = useCallback(
    (e: React.MouseEvent, did: string) => {
      e.stopPropagation();
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pos = positions[did];
      if (!pos) return;
      setDrawingEdge({
        from: did,
        mouseX: e.clientX - rect.left,
        mouseY: e.clientY - rect.top,
      });
    },
    [positions],
  );

  // ─── Remove edge ───────────────────────────────────────────────────────

  const removeEdge = useCallback((idx: number) => {
    setEdges((prev) => prev.filter((_, i) => i !== idx));
    setDirty(true);
  }, []);

  // ─── Toggle edge type ─────────────────────────────────────────────────

  const toggleEdgeType = useCallback((idx: number) => {
    setEdges((prev) =>
      prev.map((e, i) => (i === idx ? { ...e, type: e.type === 'direct' ? 'dotted' : 'direct' } : e)),
    );
    setDirty(true);
  }, []);

  // ─── Save ──────────────────────────────────────────────────────────────

  const handleSave = useCallback(async () => {
    if (!userDID) return;
    setSaving(true);
    try {
      await problemSetService.saveReportingRelationships(
        problemSetId,
        edges.map((e) => ({
          superior_did: e.from,
          subordinate_did: e.to,
          relationship_type: e.type,
        })),
        userDID,
      );
      setDirty(false);
    } catch (err) {
      console.error('[OrbatModal] save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [edges, problemSetId, userDID]);

  // ─── Canvas dimensions ─────────────────────────────────────────────────

  const canvasSize = useMemo(() => {
    let maxX = 900;
    let maxY = 500;
    for (const pos of Object.values(positions)) {
      maxX = Math.max(maxX, pos.x + NODE_W + 40);
      maxY = Math.max(maxY, pos.y + NODE_H + 40);
    }
    return { width: maxX, height: maxY };
  }, [positions]);

  // ─── Render ────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl flex flex-col"
        style={{ width: '95vw', maxWidth: 1200, height: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-700 flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-base font-semibold text-white">ORBAT — Order of Battle</h2>

            {/* Edge mode toggle */}
            <div className="flex items-center gap-1 bg-gray-800 rounded-md p-0.5 border border-gray-700">
              <button
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  edgeMode === 'direct'
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setEdgeMode('direct')}
                title="Draw direct report lines (solid)"
              >
                ── Direct
              </button>
              <button
                className={`px-2.5 py-1 text-xs rounded transition-colors ${
                  edgeMode === 'dotted'
                    ? 'bg-amber-600 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
                onClick={() => setEdgeMode('dotted')}
                title="Draw coordination lines (dotted)"
              >
                ┈┈ Dotted
              </button>
            </div>

            <span className="text-[11px] text-gray-500">
              Drag nodes to reposition. Drag from bottom handle to connect.
            </span>
          </div>

          <div className="flex items-center gap-2">
            {dirty && (
              <button
                className="px-3 py-1.5 text-xs font-medium text-white bg-green-700 hover:bg-green-600 rounded transition-colors disabled:opacity-50"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            )}
            <button
              className="text-gray-400 hover:text-white transition-colors text-xl leading-none"
              onClick={onClose}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div
          className="flex-1 overflow-auto relative"
          style={{ cursor: dragging ? 'grabbing' : drawingEdge ? 'crosshair' : 'default' }}
        >
          <div
            ref={canvasRef}
            className="relative"
            style={{ width: canvasSize.width, height: canvasSize.height, minHeight: '100%' }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              setDragging(null);
              setDrawingEdge(null);
            }}
          >
            {/* SVG edge layer */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={canvasSize.width}
              height={canvasSize.height}
              style={{ zIndex: 1 }}
            >
              <defs>
                <marker id="arrowDirect" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#60a5fa" />
                </marker>
                <marker id="arrowDotted" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
                  <path d="M0,0 L8,3 L0,6" fill="#f59e0b" />
                </marker>
              </defs>

              {/* Saved edges */}
              {edges.map((edge, idx) => {
                const fromPos = positions[edge.from];
                const toPos = positions[edge.to];
                if (!fromPos || !toPos) return null;

                const x1 = fromPos.x + NODE_W / 2;
                const y1 = fromPos.y + NODE_H;
                const x2 = toPos.x + NODE_W / 2;
                const y2 = toPos.y;

                const isDotted = edge.type === 'dotted';
                const color = isDotted ? '#f59e0b' : '#60a5fa';

                return (
                  <g key={idx} style={{ pointerEvents: 'auto', cursor: 'pointer' }}>
                    {/* Invisible wide hit area */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke="transparent"
                      strokeWidth={12}
                      onClick={(e) => {
                        e.stopPropagation();
                        // Context menu: right-click to remove, left-click to toggle type
                      }}
                      onDoubleClick={(e) => { e.stopPropagation(); removeEdge(idx); }}
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); toggleEdgeType(idx); }}
                    />
                    {/* Visible line */}
                    <line
                      x1={x1} y1={y1} x2={x2} y2={y2}
                      stroke={color}
                      strokeWidth={2}
                      strokeDasharray={isDotted ? '6,4' : undefined}
                      markerEnd={isDotted ? 'url(#arrowDotted)' : 'url(#arrowDirect)'}
                      style={{ pointerEvents: 'none' }}
                    />
                    {/* Label at midpoint */}
                    <text
                      x={(x1 + x2) / 2 + 6}
                      y={(y1 + y2) / 2 - 4}
                      fill={color}
                      fontSize={9}
                      opacity={0.7}
                      style={{ pointerEvents: 'none' }}
                    >
                      {isDotted ? 'dotted' : 'direct'}
                    </text>
                  </g>
                );
              })}

              {/* Drawing-in-progress edge */}
              {drawingEdge && (() => {
                const fromPos = positions[drawingEdge.from];
                if (!fromPos) return null;
                const x1 = fromPos.x + NODE_W / 2;
                const y1 = fromPos.y + NODE_H;
                const isDotted = edgeMode === 'dotted';
                return (
                  <line
                    x1={x1} y1={y1}
                    x2={drawingEdge.mouseX} y2={drawingEdge.mouseY}
                    stroke={isDotted ? '#f59e0b' : '#60a5fa'}
                    strokeWidth={2}
                    strokeDasharray={isDotted ? '6,4' : '4,2'}
                    opacity={0.6}
                  />
                );
              })()}
            </svg>

            {/* Node layer */}
            {members.map((m) => {
              const pos = positions[m.userDid];
              if (!pos) return null;
              const tier = getTier(m.role);
              const colors = TIER_COLORS[tier] ?? TIER_COLORS[3];
              const isSuspended = m.status === 'suspended';

              return (
                <div
                  key={m.userDid}
                  className={[
                    'absolute flex flex-col items-center justify-center rounded-lg border select-none',
                    colors.bg,
                    colors.border,
                    isSuspended ? 'opacity-50' : '',
                  ].join(' ')}
                  style={{
                    left: pos.x,
                    top: pos.y,
                    width: NODE_W,
                    height: NODE_H,
                    zIndex: dragging?.did === m.userDid ? 10 : 2,
                    cursor: dragging?.did === m.userDid ? 'grabbing' : 'grab',
                    boxShadow: dragging?.did === m.userDid ? '0 4px 20px rgba(0,0,0,0.5)' : undefined,
                  }}
                  onMouseDown={(e) => handleNodeMouseDown(e, m.userDid)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    onSelectMember?.(m);
                  }}
                  title={`${m.displayName ?? m.userDid} — ${m.role}\nDouble-click for details`}
                >
                  {/* Role badge */}
                  <span className={`text-[10px] font-bold ${colors.text}`}>
                    {getRoleLabel(m.role)}
                  </span>
                  {/* Name */}
                  <span className="text-xs text-gray-200 mt-0.5 text-center truncate px-2" style={{ maxWidth: NODE_W - 8 }}>
                    {m.displayName || shortenDid(m.userDid)}
                  </span>

                  {/* Bottom connector handle — drag to create edges */}
                  <div
                    className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-gray-600 border-2 border-gray-500 hover:bg-blue-500 hover:border-blue-400 transition-colors"
                    style={{ zIndex: 5, cursor: 'crosshair' }}
                    onMouseDown={(e) => handleConnectorMouseDown(e, m.userDid)}
                    title="Drag to connect"
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer legend */}
        <div className="flex items-center gap-6 px-5 py-2 border-t border-gray-700 text-[11px] text-gray-500 flex-shrink-0">
          <span className="flex items-center gap-1.5">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#60a5fa" strokeWidth="2" /></svg>
            Direct report
          </span>
          <span className="flex items-center gap-1.5">
            <svg width="24" height="2"><line x1="0" y1="1" x2="24" y2="1" stroke="#f59e0b" strokeWidth="2" strokeDasharray="4,3" /></svg>
            Coordination
          </span>
          <span>Double-click node = details</span>
          <span>Double-click line = remove</span>
          <span>Right-click line = toggle type</span>
        </div>
      </div>
    </div>
  );
}

export default OrbatModal;
