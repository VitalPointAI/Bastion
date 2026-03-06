/**
 * TrainingDocPreview
 *
 * Inline side panel for previewing extracted content from a training document.
 * Shows summary, key entities, collapsible full text, and metadata.
 */

import { useState } from 'react';
import type { ScenarioDocument } from '../../types/exercise.js';
import './TrainingDocPreview.css';

interface TrainingDocPreviewProps {
  document: ScenarioDocument;
  onClose: () => void;
}

export function TrainingDocPreview({ document: doc, onClose }: TrainingDocPreviewProps) {
  const [showFullText, setShowFullText] = useState(false);

  const extractedData = doc.extractedData ?? {};
  const summary = (extractedData.summary as string) || null;
  const rawExtraction = extractedData.rawExtraction as Record<string, unknown> | undefined;
  const confidence = doc.extractionConfidence;
  const isPending = confidence === 0;

  // Extract entities from rawExtraction if available
  const entities = parseEntities(rawExtraction);

  // Full text from textContent field
  const fullText = doc.textContent || null;
  const isLongText = (fullText?.length ?? 0) > 500;

  return (
    <div className="training-doc-preview">
      {/* Header */}
      <div className="preview-header">
        <div className="preview-header-info">
          <h3 className="preview-filename">{doc.filename}</h3>
          <div className="preview-badges">
            <span className={`preview-badge preview-badge--team preview-badge--${doc.team}`}>
              {doc.team}
            </span>
            <span className="preview-badge">{doc.exercisePhase}</span>
            <span className="preview-badge">{doc.documentType}</span>
          </div>
        </div>
        <button className="preview-close" onClick={onClose} aria-label="Close preview">
          x
        </button>
      </div>

      {/* Summary */}
      <div className="preview-section">
        <h4 className="preview-section-heading">Summary</h4>
        {isPending ? (
          <p className="extraction-pending">Extraction in progress...</p>
        ) : summary ? (
          <p className="preview-summary-text">{summary}</p>
        ) : (
          <p className="preview-empty">No summary available.</p>
        )}
      </div>

      {/* Key Entities */}
      {entities.length > 0 && (
        <div className="preview-section">
          <h4 className="preview-section-heading">Key Entities</h4>
          <div className="preview-entities">
            {entities.map((entity, i) => (
              <span key={i} className="preview-entity-chip">{entity}</span>
            ))}
          </div>
        </div>
      )}

      {/* Full Text */}
      {fullText && (
        <div className="preview-section">
          <h4 className="preview-section-heading">Full Text</h4>
          {isLongText && !showFullText ? (
            <>
              <p className="preview-fulltext-snippet">
                {fullText.slice(0, 500)}...
              </p>
              <button
                className="preview-toggle-btn"
                onClick={() => setShowFullText(true)}
              >
                Show full text
              </button>
            </>
          ) : (
            <>
              <div className="preview-fulltext">{fullText}</div>
              {isLongText && (
                <button
                  className="preview-toggle-btn"
                  onClick={() => setShowFullText(false)}
                >
                  Hide full text
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Metadata Footer */}
      <div className="preview-metadata">
        <span>Confidence: {isPending ? 'Pending' : `${Math.round(confidence * 100)}%`}</span>
        <span>Type: {doc.documentType}</span>
      </div>
    </div>
  );
}

/**
 * Extract entity strings from rawExtraction data.
 * Handles various shapes: string[], object with name fields, or keys of the object.
 */
function parseEntities(rawExtraction: Record<string, unknown> | undefined): string[] {
  if (!rawExtraction) return [];

  // Check for common entity-related keys
  const entityKeys = ['entities', 'keyEntities', 'key_entities', 'actors', 'countries', 'organizations'];
  for (const key of entityKeys) {
    const val = rawExtraction[key];
    if (Array.isArray(val)) {
      return val.map((item) => {
        if (typeof item === 'string') return item;
        if (typeof item === 'object' && item !== null && 'name' in item) return String((item as { name: unknown }).name);
        return String(item);
      }).filter(Boolean);
    }
  }

  return [];
}
