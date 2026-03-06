/**
 * LOELane
 *
 * Phase 25 Plan 04: A single horizontal lane representing one Line of Effort
 * in the timeline. Renders as an SVG group with lane background, LOE label,
 * and decisive points positioned by phase.
 */

import { useState, useRef, useEffect } from 'react';
import type { LineOfEffort, DecisivePoint, CoGNode, LOECoGLink } from '../../lib/design-service.ts';
import { DecisivePointNode } from './DecisivePointNode.tsx';

interface Phase {
  id: string;
  name: string;
}

interface LOELaneProps {
  loe: LineOfEffort;
  phases: Phase[];
  phaseWidth: number;
  laneHeight: number;
  labelWidth: number;
  onLoeUpdate: (loe: LineOfEffort) => void;
  onLoeDelete: (loeId: string) => void;
  cogVulnerabilities: CoGNode[];
  yOffset: number;
}

export function LOELane({
  loe,
  phases,
  phaseWidth,
  laneHeight,
  labelWidth,
  onLoeUpdate,
  onLoeDelete,
  cogVulnerabilities,
  yOffset,
}: LOELaneProps) {
  const [hovered, setHovered] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(loe.name);
  const [hoveredPhaseIdx, setHoveredPhaseIdx] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalWidth = labelWidth + phases.length * phaseWidth;

  useEffect(() => {
    if (editingName && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingName]);

  // Sync name if external update
  useEffect(() => {
    setNameValue(loe.name);
  }, [loe.name]);

  const handleSaveName = () => {
    setEditingName(false);
    if (nameValue.trim() && nameValue !== loe.name) {
      onLoeUpdate({ ...loe, name: nameValue.trim() });
    } else {
      setNameValue(loe.name);
    }
  };

  const handleAddDP = (phaseId: string) => {
    const newDP: DecisivePoint = {
      id: crypto.randomUUID(),
      label: 'New DP',
      description: '',
      phase: phaseId,
      position: loe.decisivePoints.filter((d) => d.phase === phaseId).length,
      cogLinks: [] as LOECoGLink[],
    };
    onLoeUpdate({ ...loe, decisivePoints: [...loe.decisivePoints, newDP] });
  };

  const handleUpdateDP = (updated: DecisivePoint) => {
    onLoeUpdate({
      ...loe,
      decisivePoints: loe.decisivePoints.map((d) => (d.id === updated.id ? updated : d)),
    });
  };

  const handleDeleteDP = (dpId: string) => {
    onLoeUpdate({
      ...loe,
      decisivePoints: loe.decisivePoints.filter((d) => d.id !== dpId),
    });
  };

  return (
    <g
      transform={`translate(0, ${yOffset})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Lane background */}
      <rect
        x={0}
        y={0}
        width={totalWidth}
        height={laneHeight}
        fill={loe.order % 2 === 0 ? 'rgba(31,41,55,0.5)' : 'rgba(31,41,55,0.3)'}
        stroke="#374151"
        strokeWidth={0.5}
      />

      {/* Label area background */}
      <rect x={0} y={0} width={labelWidth} height={laneHeight} fill="rgba(17,24,39,0.7)" />

      {/* LOE label */}
      {!editingName ? (
        <g onClick={() => setEditingName(true)} style={{ cursor: 'text' }}>
          <text
            x={12}
            y={laneHeight / 2 - 4}
            fill="#e5e7eb"
            fontSize={13}
            fontWeight={600}
            style={{ pointerEvents: 'all' }}
          >
            {loe.name || 'Unnamed LOE'}
          </text>
          <text x={12} y={laneHeight / 2 + 14} fill="#6b7280" fontSize={10}>
            {loe.decisivePoints.length} decisive point{loe.decisivePoints.length !== 1 ? 's' : ''}
          </text>
        </g>
      ) : (
        <foreignObject x={8} y={laneHeight / 2 - 14} width={labelWidth - 16} height={28}>
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName();
              if (e.key === 'Escape') {
                setNameValue(loe.name);
                setEditingName(false);
              }
            }}
            style={{
              width: '100%',
              background: '#1f2937',
              border: '1px solid #4b5563',
              borderRadius: 4,
              padding: '2px 6px',
              color: '#e5e7eb',
              fontSize: 13,
              fontWeight: 600,
              outline: 'none',
            }}
          />
        </foreignObject>
      )}

      {/* Edit icon on hover */}
      {hovered && !editingName && (
        <g onClick={() => setEditingName(true)} style={{ cursor: 'pointer' }}>
          <text x={labelWidth - 36} y={laneHeight / 2 + 4} fill="#6b7280" fontSize={12}>
            edit
          </text>
        </g>
      )}

      {/* Delete LOE icon on hover */}
      {hovered && (
        <g
          onClick={() => onLoeDelete(loe.id)}
          style={{ cursor: 'pointer' }}
        >
          <circle cx={labelWidth - 14} cy={laneHeight / 2} r={8} fill="#7f1d1d" opacity={0.8} />
          <text
            x={labelWidth - 14}
            y={laneHeight / 2 + 4}
            textAnchor="middle"
            fill="#fca5a5"
            fontSize={11}
          >
            x
          </text>
        </g>
      )}

      {/* Phase column regions + decisive points */}
      {phases.map((phase, phaseIdx) => {
        const phaseX = labelWidth + phaseIdx * phaseWidth;
        const phaseDPs = loe.decisivePoints.filter((d) => d.phase === phase.id);
        const isPhaseHovered = hoveredPhaseIdx === phaseIdx;

        return (
          <g
            key={phase.id}
            onMouseEnter={() => setHoveredPhaseIdx(phaseIdx)}
            onMouseLeave={() => setHoveredPhaseIdx(null)}
          >
            {/* Phase region hover highlight */}
            <rect
              x={phaseX}
              y={0}
              width={phaseWidth}
              height={laneHeight}
              fill={isPhaseHovered ? 'rgba(59,130,246,0.05)' : 'transparent'}
              style={{ pointerEvents: 'all' }}
            />

            {/* Decisive points within this phase */}
            {phaseDPs.map((dp, dpIdx) => {
              const dpX = phaseX + (phaseWidth / (phaseDPs.length + 1)) * (dpIdx + 1);
              const dpY = laneHeight / 2;

              return (
                <DecisivePointNode
                  key={dp.id}
                  dp={dp}
                  x={dpX}
                  y={dpY}
                  onUpdate={handleUpdateDP}
                  onDelete={handleDeleteDP}
                  cogVulnerabilities={cogVulnerabilities}
                  loeId={loe.id}
                />
              );
            })}

            {/* Add DP button on phase hover */}
            {isPhaseHovered && (
              <g
                onClick={() => handleAddDP(phase.id)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  cx={phaseX + phaseWidth / 2}
                  cy={laneHeight - 14}
                  r={8}
                  fill="#1e3a5f"
                  stroke="#3b82f6"
                  strokeWidth={1}
                />
                <text
                  x={phaseX + phaseWidth / 2}
                  y={laneHeight - 10}
                  textAnchor="middle"
                  fill="#93c5fd"
                  fontSize={14}
                  fontWeight={700}
                  style={{ pointerEvents: 'none' }}
                >
                  +
                </text>
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
}
