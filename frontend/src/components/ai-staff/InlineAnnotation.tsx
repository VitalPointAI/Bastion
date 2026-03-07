/**
 * InlineAnnotation -- Google Docs-style inline annotation
 *
 * Wraps content in a highlighted span with a click-to-expand popover showing
 * the full recommendation, suggested change, confidence badge, and action
 * buttons (Accept/Dismiss/Modify/Escalate).
 *
 * Auto-applied annotations show a subtle highlight that fades over 3 seconds.
 */

import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react';
import type { AIAnnotation, FeedItemAction } from '../../types/ai-staff';
import { CONFIDENCE_STYLES } from '../../types/ai-staff';
import './InlineAnnotation.css';

interface InlineAnnotationProps {
  annotation: AIAnnotation;
  children: ReactNode;
  onAction: (annotationId: string, action: FeedItemAction) => void;
}

const ACTIONS: { action: FeedItemAction; label: string; className: string }[] = [
  { action: 'accept', label: 'Accept', className: 'inline-annotation-action--accept' },
  { action: 'dismiss', label: 'Dismiss', className: 'inline-annotation-action--dismiss' },
  { action: 'modify', label: 'Modify', className: 'inline-annotation-action--modify' },
  { action: 'escalate', label: 'Escalate', className: 'inline-annotation-action--escalate' },
];

export function InlineAnnotation({ annotation, children, onAction }: InlineAnnotationProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState<'above' | 'below'>('above');
  const spanRef = useRef<HTMLSpanElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const isAutoApplied = annotation.isAutoApply && annotation.status === 'accepted';

  // Determine popover position (above or below) based on available space
  const updatePosition = useCallback(() => {
    if (!spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    const spaceAbove = rect.top;
    const spaceBelow = window.innerHeight - rect.bottom;
    setPosition(spaceAbove > spaceBelow ? 'above' : 'below');
  }, []);

  // Close popover on click outside
  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        spanRef.current &&
        !spanRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  function handleSpanClick() {
    if (isAutoApplied) return; // Don't expand auto-applied annotations
    updatePosition();
    setIsOpen((prev) => !prev);
  }

  const confidenceStyle = CONFIDENCE_STYLES[annotation.confidence];

  return (
    <span className="inline-annotation-wrapper" ref={spanRef}>
      <span
        className={[
          'inline-annotation',
          isAutoApplied ? 'inline-annotation--auto-applied' : '',
          isOpen ? 'inline-annotation--active' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={handleSpanClick}
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        aria-label={`AI annotation by ${annotation.agentDisplayName}`}
      >
        {children}
      </span>

      {isOpen && (
        <div
          ref={popoverRef}
          className={`inline-annotation-popover inline-annotation-popover--${position}`}
        >
          <div className="inline-annotation-popover__header">
            <span className="inline-annotation-popover__agent">
              {annotation.agentDisplayName}
            </span>
            <span
              className="inline-annotation-popover__confidence"
              style={{ color: confidenceStyle.color }}
            >
              {confidenceStyle.label}
            </span>
          </div>

          <div className="inline-annotation-popover__content">
            {annotation.content}
          </div>

          {annotation.suggestedChange && (
            <div className="inline-annotation-popover__suggestion">
              <span className="inline-annotation-popover__suggestion-label">
                Suggested change:
              </span>
              {annotation.suggestedChange}
            </div>
          )}

          <div className="inline-annotation-popover__actions">
            {ACTIONS.map(({ action, label, className }) => (
              <button
                key={action}
                className={`inline-annotation-action ${className}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onAction(annotation.annotationId, action);
                  setIsOpen(false);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
