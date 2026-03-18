/**
 * SmartSuggestionChips — Clickable pipeline suggestion chips for ambiguous input
 *
 * Phase 50 Plan 04. Renders when a classification result has low confidence
 * (< 0.85) or suggests manual review, offering the user concrete routing choices.
 *
 * Design:
 * - Only renders for ambiguous/low-confidence items
 * - Chip labels are derived from classification metadata
 * - Each chip triggers the parent to re-submit with a forced pipeline selection
 */

import React from 'react';
import type { IngestItem } from './hooks/useUniversalIngest.js';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SmartSuggestionChipsProps {
  item: IngestItem;
  onSelect: (itemId: string, pipeline: string) => void;
}

// ─── Chip definitions ─────────────────────────────────────────────────────────

interface Chip {
  label: string;
  pipeline: string;
  ariaLabel: string;
}

function buildChips(item: IngestItem): Chip[] {
  const classification = item.classification;
  if (!classification) {
    // No classification yet — offer generic options
    return [
      { label: 'Ingest as document', pipeline: 'doc-intelligence', ariaLabel: 'Ingest as document' },
      { label: 'Add as OSINT source', pipeline: 'osint-subscribe', ariaLabel: 'Add as OSINT source' },
      { label: 'Save as note', pipeline: 'text-ingest', ariaLabel: 'Save as intelligence note' },
    ];
  }

  const { inputType, metadata } = classification;
  const chips: Chip[] = [];

  // RSS/feed signals
  if (inputType === 'rss_url' || metadata?.isRss) {
    chips.push({ label: 'Subscribe as RSS feed', pipeline: 'osint-subscribe', ariaLabel: 'Subscribe as RSS feed' });
    chips.push({ label: 'Ingest as document', pipeline: 'doc-intelligence', ariaLabel: 'Ingest as a one-time document' });
    return chips;
  }

  // Article / web URL signals
  if (inputType === 'article_url' || inputType === 'pdf_url') {
    chips.push({ label: 'Ingest as document', pipeline: 'doc-intelligence', ariaLabel: 'Ingest as document' });
    chips.push({ label: 'Add as OSINT source', pipeline: 'osint-subscribe', ariaLabel: 'Add as recurring OSINT source' });
    return chips;
  }

  // Raw text signals
  if (inputType === 'raw_text') {
    chips.push({ label: 'Treat as intelligence report', pipeline: 'doc-intelligence', ariaLabel: 'Process as intelligence report' });
    chips.push({ label: 'Treat as freeform note', pipeline: 'text-ingest', ariaLabel: 'Save as freeform note' });
    return chips;
  }

  // Unknown or generic
  chips.push({ label: 'Ingest as document', pipeline: 'doc-intelligence', ariaLabel: 'Ingest as document' });
  chips.push({ label: 'Add as OSINT source', pipeline: 'osint-subscribe', ariaLabel: 'Add as OSINT source' });
  chips.push({ label: 'Save as note', pipeline: 'text-ingest', ariaLabel: 'Save as intelligence note' });
  return chips;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SmartSuggestionChips({ item, onSelect }: SmartSuggestionChipsProps) {
  const { classification } = item;

  // Only render for ambiguous or low-confidence classifications
  const isAmbiguous =
    !classification ||
    classification.confidence < 0.85 ||
    classification.suggestedPipeline === 'manual';

  if (!isAmbiguous) return null;

  const chips = buildChips(item);

  return (
    <div
      className="smart-suggestion-chips"
      role="group"
      aria-label={`Suggestions for how to process: ${item.label}`}
    >
      <span className="smart-suggestion-chips__label">How should this be processed?</span>
      <div className="smart-suggestion-chips__list">
        {chips.map((chip) => (
          <button
            key={chip.pipeline}
            type="button"
            className="smart-suggestion-chip"
            aria-label={chip.ariaLabel}
            onClick={() => onSelect(item.id, chip.pipeline)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}
