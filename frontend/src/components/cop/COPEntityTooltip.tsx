/**
 * COPEntityTooltip Component
 *
 * Floating tooltip shown on symbol hover. Displays entity name, affiliation,
 * CCO class, SIDC code, confidence indicator, and key linked entities.
 * Fetches linkages via copService on mount.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { COPSymbolSpec } from '../../types/cop.js';
import { copService } from '../../lib/cop-service.js';
import type { EntityLinkage } from '../../lib/cop-service.js';
import './COPEntityTooltip.css';

interface COPEntityTooltipProps {
  symbol: COPSymbolSpec;
  /** Screen coordinates for tooltip positioning */
  position: { x: number; y: number };
  onClose: () => void;
  onClickDetail: () => void;
}

/** Affiliation display colors */
const AFFILIATION_COLORS: Record<string, string> = {
  friendly: '#3b82f6',
  enemy: '#ef4444',
  neutral: '#22c55e',
  unknown: '#eab308',
};

/** Affiliation display labels */
const AFFILIATION_LABELS: Record<string, string> = {
  friendly: 'FRIENDLY',
  enemy: 'ENEMY',
  neutral: 'NEUTRAL',
  unknown: 'UNKNOWN',
};

/** Discovery method display labels */
const METHOD_LABELS: Record<string, string> = {
  graph_traversal: 'Graph',
  embedding_similarity: 'Embedding',
  manual: 'Manual',
};

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.85) return '#22c55e';
  if (confidence >= 0.7) return '#eab308';
  return '#ef4444';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.85) return 'HIGH';
  if (confidence >= 0.7) return 'MODERATE';
  return 'LOW';
}

export function COPEntityTooltip({
  symbol,
  position,
  onClose,
  onClickDetail,
}: COPEntityTooltipProps) {
  const [linkages, setLinkages] = useState<EntityLinkage[]>([]);
  const [loading, setLoading] = useState(true);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [prevEntityId, setPrevEntityId] = useState(symbol.entityId);

  // Reset loading state when entityId changes (React-endorsed setState during render)
  if (symbol.entityId !== prevEntityId) {
    setPrevEntityId(symbol.entityId);
    setLoading(true);
    setLinkages([]);
  }

  // Fetch entity linkages on mount
  useEffect(() => {
    let cancelled = false;
    copService.getEntityLinkages(symbol.entityId).then((result) => {
      if (!cancelled) {
        setLinkages(result.slice(0, 5));
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [symbol.entityId]);

  // Position tooltip to avoid map edge overflow
  useEffect(() => {
    if (!tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    let left = position.x + 12;
    let top = position.y - 12;

    if (left + rect.width > viewW - 16) {
      left = position.x - rect.width - 12;
    }
    if (top + rect.height > viewH - 16) {
      top = viewH - rect.height - 16;
    }
    if (top < 16) top = 16;
    if (left < 16) left = 16;

    el.style.left = `${left}px`;
    el.style.top = `${top}px`;
  }, [position, loading]);

  const handleMouseEnter = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const handleMouseLeave = useCallback(() => {
    closeTimerRef.current = setTimeout(onClose, 200);
  }, [onClose]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const affColor = AFFILIATION_COLORS[symbol.affiliation] ?? '#6b7280';
  const affLabel = AFFILIATION_LABELS[symbol.affiliation] ?? 'UNKNOWN';
  const confColor = getConfidenceColor(symbol.confidence);
  const confLabel = getConfidenceLabel(symbol.confidence);

  return (
    <div
      ref={tooltipRef}
      className="cop-entity-tooltip"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{ left: position.x + 12, top: position.y - 12 }}
    >
      {/* Entity Name */}
      <div className="tooltip-header">
        <span className="tooltip-designation">{symbol.designation}</span>
        <span
          className="tooltip-affiliation-badge"
          style={{ backgroundColor: affColor }}
        >
          {affLabel}
        </span>
      </div>

      {/* CCO Class & SIDC */}
      <div className="tooltip-meta">
        <span className="tooltip-cco-class">{symbol.ccoClass}</span>
        <code className="tooltip-sidc">{symbol.sidc}</code>
      </div>

      {/* Confidence Indicator */}
      <div className="tooltip-confidence">
        <span className="tooltip-confidence-label">
          Confidence: {confLabel} ({Math.round(symbol.confidence * 100)}%)
        </span>
        <div className="tooltip-confidence-bar">
          <div
            className="tooltip-confidence-fill"
            style={{
              width: `${symbol.confidence * 100}%`,
              backgroundColor: confColor,
            }}
          />
        </div>
      </div>

      {/* Key Linked Entities */}
      <div className="tooltip-linkages">
        <span className="tooltip-section-label">Key Linked Entities</span>
        {loading ? (
          <span className="tooltip-loading">Loading...</span>
        ) : linkages.length === 0 ? (
          <span className="tooltip-empty">No linked entities</span>
        ) : (
          <ul className="tooltip-linkage-list">
            {linkages.map((link) => (
              <li key={link.id} className="tooltip-linkage-item">
                <span className="linkage-name">
                  {link.entityId.slice(0, 12)}...
                </span>
                <span className="linkage-relationship">
                  {METHOD_LABELS[link.discoveryMethod] ?? link.discoveryMethod}
                  {' '}
                  ({Math.round(link.confidence * 100)}%)
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* View Details Link */}
      <button
        className="tooltip-detail-link"
        onClick={(e) => {
          e.stopPropagation();
          onClickDetail();
        }}
        type="button"
      >
        View Details
      </button>
    </div>
  );
}
