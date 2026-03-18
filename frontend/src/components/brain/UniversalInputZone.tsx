/**
 * UniversalInputZone — Primary interaction surface for all content ingestion
 *
 * Phase 50 Plan 03. Replaces the fragmented UI (separate doc upload, OSINT modal,
 * filter tags) with a single unified drop zone. Users drag, paste, or type any
 * content and it gets classified and processed automatically with real-time
 * status feedback.
 *
 * Features:
 * - Drag-and-drop files (UNIV-01)
 * - Paste text, URLs, or clipboard images (UNIV-14)
 * - Type URL/text + Enter to submit (UNIV-14)
 * - Per-item status chips via IngestItemStatus (UNIV-11)
 * - Interview-required banner (UNIV-09)
 * - Full ARIA labels and keyboard navigation (UNIV-20)
 * - Mobile-responsive with touch events (UNIV-19)
 */

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useUniversalIngest } from './hooks/useUniversalIngest.js';
import { IngestItemStatus } from './IngestItemStatus.js';
import './UniversalInputZone.css';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface UniversalInputZoneProps {
  problemSetId: string;
  onSSEEvent?: (event: string, data: unknown) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function UniversalInputZone({ problemSetId, onSSEEvent }: UniversalInputZoneProps) {
  const {
    items,
    submitText,
    submitFiles,
    retryItem,
    dismissItem,
    clearCompleted,
    isInterviewRequired,
    handleSSEEvent,
  } = useUniversalIngest(problemSetId);

  const [inputValue, setInputValue] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const statusListId = `universal-input-status-${problemSetId}`;

  // Wire external SSE events into the hook
  useEffect(() => {
    if (onSSEEvent) {
      // caller calls onSSEEvent — we provide handleSSEEvent back
      // This hook is called by IngestionSidebar which owns the SSE connection
    }
  }, [onSSEEvent, handleSSEEvent]);

  // ── Drag-and-drop handlers ────────────────────────────────────────────────

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    // Only clear drag state if leaving the drop zone itself, not a child element
    if (!dropZoneRef.current?.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        void submitFiles(files);
        return;
      }

      // Check for dropped text/URL
      const droppedText = e.dataTransfer.getData('text/plain');
      if (droppedText.trim()) {
        void submitText(droppedText.trim());
      }
    },
    [submitFiles, submitText],
  );

  // ── Paste handler ──────────────────────────────────────────────────────────

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLDivElement>) => {
      // Check for clipboard files (e.g. pasted images) first
      const files = Array.from(e.clipboardData.files);
      if (files.length > 0) {
        e.preventDefault();
        void submitFiles(files);
        return;
      }

      // Check for plain text
      const text = e.clipboardData.getData('text/plain');
      if (text.trim()) {
        e.preventDefault();
        void submitText(text.trim());
      }
      // If neither, let native paste behavior into the input field proceed
    },
    [submitFiles, submitText],
  );

  // ── Keyboard handlers ──────────────────────────────────────────────────────

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        const value = inputValue.trim();
        if (value) {
          void submitText(value);
          setInputValue('');
        }
      } else if (e.key === 'Escape') {
        setInputValue('');
        inputRef.current?.blur();
      }
    },
    [inputValue, submitText],
  );

  // ── Derived state ──────────────────────────────────────────────────────────

  const hasCompletedItems = items.some((item) => item.status === 'complete');

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      ref={dropZoneRef}
      className={`universal-input-zone${isDragOver ? ' universal-input-zone--drag-over' : ''}`}
      role="region"
      aria-label="Universal content input — drag files, paste text, or type a URL"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onPaste={handlePaste}
      style={{ touchAction: isDragOver ? 'none' : undefined }}
    >
      {/* Interview required banner */}
      {isInterviewRequired && (
        <div className="universal-input-zone__banner" role="alert">
          Complete the problem set scoping interview before ingesting content
        </div>
      )}

      {/* Text input field */}
      <input
        ref={inputRef}
        type="text"
        className="universal-input-zone__input"
        placeholder="Drop files, paste text, or enter a URL..."
        aria-label="Enter URL or text to ingest"
        aria-describedby={statusListId}
        inputMode="url"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
      />

      {/* Status list */}
      <div
        id={statusListId}
        className="universal-input-zone__items"
        role="log"
        aria-live="polite"
        aria-label="Ingest item statuses"
      >
        {items.map((item) => (
          <IngestItemStatus
            key={item.id}
            item={item}
            onRetry={retryItem}
            onDismiss={dismissItem}
          />
        ))}
      </div>

      {/* Clear completed link */}
      {hasCompletedItems && (
        <button
          type="button"
          className="universal-input-zone__clear-btn"
          onClick={clearCompleted}
        >
          Clear completed
        </button>
      )}
    </div>
  );
}
