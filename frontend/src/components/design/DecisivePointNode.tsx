/**
 * DecisivePointNode
 *
 * Phase 25 Plan 04: Interactive decisive point marker on the LOE timeline.
 * Renders as an SVG group with diamond shape, label, CoG link indicators,
 * and edit/link popovers.
 */

import { useState, useRef, useEffect } from 'react';
import type { DecisivePoint, CoGNode, LOECoGLink } from '../../lib/design-service.ts';

interface DecisivePointNodeProps {
  dp: DecisivePoint;
  x: number;
  y: number;
  onUpdate: (dp: DecisivePoint) => void;
  onDelete: (dpId: string) => void;
  cogVulnerabilities: CoGNode[];
  loeId: string;
}

export function DecisivePointNode({
  dp,
  x,
  y,
  onUpdate,
  onDelete,
  cogVulnerabilities,
  loeId,
}: DecisivePointNodeProps) {
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
  const [editLabel, setEditLabel] = useState(dp.label);
  const [editDesc, setEditDesc] = useState(dp.description);
  const popoverRef = useRef<HTMLDivElement>(null);

  const hasLinks = dp.cogLinks.length > 0;
  const fillColor = hasLinks ? '#065f46' : '#374151';
  const strokeColor = hasLinks ? '#10b981' : '#6b7280';
  const size = 12;

  // Close popovers on outside click
  useEffect(() => {
    if (!editing && !linking) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEditing(false);
        setLinking(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editing, linking]);

  const handleSaveEdit = () => {
    onUpdate({ ...dp, label: editLabel, description: editDesc });
    setEditing(false);
  };

  const handleLinkCV = (cv: CoGNode) => {
    const alreadyLinked = dp.cogLinks.some((l) => l.cogNodeId === cv.id);
    if (alreadyLinked) return;
    const newLink: LOECoGLink = {
      loeId,
      decisivePointId: dp.id,
      cogNodeId: cv.id,
      cogNodeType: cv.type,
    };
    onUpdate({ ...dp, cogLinks: [...dp.cogLinks, newLink] });
  };

  const handleUnlinkCV = (cogNodeId: string) => {
    onUpdate({ ...dp, cogLinks: dp.cogLinks.filter((l) => l.cogNodeId !== cogNodeId) });
  };

  // Truncate label for display
  const displayLabel = dp.label.length > 18 ? dp.label.slice(0, 16) + '...' : dp.label;

  // Get linked CV names for tooltip
  const linkedCVNames = dp.cogLinks
    .map((l) => cogVulnerabilities.find((cv) => cv.id === l.cogNodeId)?.label)
    .filter(Boolean);

  return (
    <g
      transform={`translate(${x}, ${y})`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ cursor: 'pointer' }}
    >
      {/* Diamond shape */}
      <rect
        x={-size}
        y={-size}
        width={size * 2}
        height={size * 2}
        transform="rotate(45)"
        fill={fillColor}
        stroke={strokeColor}
        strokeWidth={2}
        rx={2}
        onClick={() => {
          setEditLabel(dp.label);
          setEditDesc(dp.description);
          setEditing(true);
          setLinking(false);
        }}
      />

      {/* CoG link indicator dot */}
      {hasLinks && (
        <circle cx={size + 4} cy={-size - 4} r={4} fill="#10b981" stroke="#065f46" strokeWidth={1} />
      )}

      {/* Label below */}
      <text
        y={size + 16}
        textAnchor="middle"
        fill="#d1d5db"
        fontSize={11}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        {displayLabel}
      </text>

      {/* Hover tooltip for linked CVs */}
      {hovered && linkedCVNames.length > 0 && !editing && !linking && (
        <foreignObject x={-100} y={-size - 60} width={200} height={50}>
          <div
            style={{
              background: '#1f2937',
              border: '1px solid #4b5563',
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              color: '#d1d5db',
              textAlign: 'center',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Linked: {linkedCVNames.join(', ')}
          </div>
        </foreignObject>
      )}

      {/* Delete button on hover */}
      {hovered && !editing && !linking && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            onDelete(dp.id);
          }}
        >
          <circle cx={size + 4} cy={size + 4} r={7} fill="#7f1d1d" stroke="#ef4444" strokeWidth={1} />
          <text
            x={size + 4}
            y={size + 8}
            textAnchor="middle"
            fill="#fca5a5"
            fontSize={10}
            style={{ pointerEvents: 'none' }}
          >
            x
          </text>
        </g>
      )}

      {/* Link to CV button on hover */}
      {hovered && !editing && !linking && (
        <g
          onClick={(e) => {
            e.stopPropagation();
            setLinking(true);
            setEditing(false);
          }}
        >
          <circle cx={-(size + 4)} cy={size + 4} r={7} fill="#1e3a5f" stroke="#3b82f6" strokeWidth={1} />
          <text
            x={-(size + 4)}
            y={size + 8}
            textAnchor="middle"
            fill="#93c5fd"
            fontSize={8}
            style={{ pointerEvents: 'none' }}
          >
            CV
          </text>
        </g>
      )}

      {/* Edit Popover */}
      {editing && (
        <foreignObject x={-120} y={size + 24} width={240} height={180}>
          <div
            ref={popoverRef}
            style={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>
                Label
              </label>
              <input
                type="text"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                style={{
                  width: '100%',
                  background: '#1f2937',
                  border: '1px solid #4b5563',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#e5e7eb',
                  fontSize: 12,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 11, color: '#9ca3af', display: 'block', marginBottom: 2 }}>
                Description
              </label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: '#1f2937',
                  border: '1px solid #4b5563',
                  borderRadius: 4,
                  padding: '4px 8px',
                  color: '#e5e7eb',
                  fontSize: 12,
                  outline: 'none',
                  resize: 'vertical',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setEditing(false)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: 4,
                  color: '#d1d5db',
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: '#2563eb',
                  border: 'none',
                  borderRadius: 4,
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        </foreignObject>
      )}

      {/* CoG Link Popover */}
      {linking && (
        <foreignObject x={-140} y={size + 24} width={280} height={220}>
          <div
            ref={popoverRef}
            style={{
              background: '#111827',
              border: '1px solid #374151',
              borderRadius: 6,
              padding: 12,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              maxHeight: 210,
              overflowY: 'auto',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 600, color: '#e5e7eb', marginBottom: 8 }}>
              Link to Critical Vulnerabilities
            </div>

            {/* Current links */}
            {dp.cogLinks.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Linked:</div>
                {dp.cogLinks.map((link) => {
                  const cv = cogVulnerabilities.find((v) => v.id === link.cogNodeId);
                  return (
                    <div
                      key={link.cogNodeId}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '3px 6px',
                        background: '#064e3b',
                        borderRadius: 4,
                        marginBottom: 3,
                        fontSize: 11,
                        color: '#a7f3d0',
                      }}
                    >
                      <span>{cv?.label ?? link.cogNodeId}</span>
                      <button
                        onClick={() => handleUnlinkCV(link.cogNodeId)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fca5a5',
                          cursor: 'pointer',
                          fontSize: 11,
                          padding: '0 4px',
                        }}
                      >
                        Unlink
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Available CVs */}
            <div style={{ fontSize: 10, color: '#6b7280', marginBottom: 4 }}>Available CVs:</div>
            {cogVulnerabilities.length === 0 && (
              <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic' }}>
                No critical vulnerabilities found. Add them in CoG Analysis first.
              </div>
            )}
            {cogVulnerabilities
              .filter((cv) => !dp.cogLinks.some((l) => l.cogNodeId === cv.id))
              .map((cv) => (
                <button
                  key={cv.id}
                  onClick={() => handleLinkCV(cv)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '4px 8px',
                    background: '#1f2937',
                    border: '1px solid #374151',
                    borderRadius: 4,
                    marginBottom: 3,
                    fontSize: 11,
                    color: '#d1d5db',
                    cursor: 'pointer',
                  }}
                >
                  {cv.label}
                </button>
              ))}

            <div style={{ marginTop: 8, textAlign: 'right' }}>
              <button
                onClick={() => setLinking(false)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  background: '#374151',
                  border: '1px solid #4b5563',
                  borderRadius: 4,
                  color: '#d1d5db',
                  cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </foreignObject>
      )}
    </g>
  );
}
