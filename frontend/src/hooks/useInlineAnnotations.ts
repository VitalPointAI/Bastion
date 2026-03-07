/**
 * useInlineAnnotations
 *
 * Annotation state management per content area.
 * Filters annotations from AIStaffContext by targetContentId.
 *
 * Provides the state layer for inline annotations; full rendering
 * with Google Docs-style highlights will be built in Plan 05's
 * InlineAnnotation component.
 */

import { useMemo, useCallback } from 'react';
import { useAIStaff, useAIStaffDispatch } from '../context/AIStaffContext.tsx';
import { aiStaffService } from '../lib/ai-staff-service.ts';
import type { AIAnnotation, FeedItemAction } from '../types/ai-staff.ts';

// ─── Public interface ────────────────────────────────────────────────────────

export interface UseInlineAnnotationsResult {
  /** Annotations filtered for the given content area */
  annotations: AIAnnotation[];
  /** Handle an action on an annotation (accept, dismiss, modify, escalate) */
  handleAction: (annotationId: string, action: FeedItemAction) => Promise<void>;
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useInlineAnnotations(
  problemSetId: string | null,
  contentId: string,
): UseInlineAnnotationsResult {
  const { annotations: allAnnotations } = useAIStaff();
  const dispatch = useAIStaffDispatch();

  // Filter annotations for this content area
  const annotations = useMemo(
    () => allAnnotations.filter((a) => a.targetContentId === contentId),
    [allAnnotations, contentId],
  );

  // Handle annotation action -- update backend + dispatch to context
  const handleAction = useCallback(
    async (annotationId: string, action: FeedItemAction): Promise<void> => {
      if (!problemSetId) return;

      // Map FeedItemAction to annotation status
      const statusMap: Record<FeedItemAction, AIAnnotation['status']> = {
        accept: 'accepted',
        dismiss: 'dismissed',
        modify: 'modified',
        escalate: 'escalated',
      };
      const newStatus = statusMap[action];

      // Optimistic update
      dispatch.updateAnnotationStatus(annotationId, newStatus);

      try {
        await aiStaffService.updateAnnotation(problemSetId, annotationId, action);
      } catch (err) {
        console.error('[useInlineAnnotations] handleAction failed:', err);
        // Revert to pending on failure
        dispatch.updateAnnotationStatus(annotationId, 'pending');
      }
    },
    [problemSetId, dispatch],
  );

  return { annotations, handleAction };
}
