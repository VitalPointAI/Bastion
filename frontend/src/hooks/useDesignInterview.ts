/**
 * useDesignInterview — React hook for design interview lifecycle
 *
 * Phase 55 Plan 04: Manages the full guided design interview lifecycle
 * including start, continue, confirm section, resume, and reset.
 * Listens for real-time design.section_updated WebSocket events.
 *
 * Phase 55 Plan 06: Added Yjs collaborative state sync for multi-user
 * interview support. Multiple participants see shared interview state,
 * participant roles, and role-directed question indicators.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import * as Y from 'yjs';
import { useYjsDocument } from '../lib/yjs-hooks.ts';
import { useUser } from '../context/UserContext.tsx';
import { useProblemSet } from '../context/ProblemSetContext.tsx';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SectionCoverage {
  met: boolean;
  criteria: string[];
  metCriteria: string[];
}

export interface DesignInterviewMeta {
  currentSection: 'problem-framing' | 'cog-analysis' | 'loes' | 'operational-approach';
  sectionCoverage: Record<string, SectionCoverage>;
  questionsAsked: number;
  isComplete: boolean;
  interviewMode: 'new' | 'revision';
}

export interface UseDesignInterviewResult {
  interviewState: DesignInterviewMeta | null;
  isActive: boolean;
  isLoading: boolean;
  lastMessage: string | null;
  error: string | null;
  startInterview: (mode?: 'new' | 'revision') => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  confirmSection: () => Promise<void>;
  resetInterview: () => Promise<void>;
  awaitingConfirm: boolean;
  // Collaborative state (Plan 06)
  participants: Map<string, string>;  // did -> role of active participants
  isCollaborative: boolean;           // true if >1 participant
  directedRole: string | null;        // role targeted by current question
  currentUserRole: string | null;     // local user's role in this problem set
  isMyTurn: boolean;                  // true if directed question targets current user's role
}

// ---------------------------------------------------------------------------
// Role color constants
// ---------------------------------------------------------------------------

export const ROLE_COLORS: Record<string, string> = {
  J2: '#3b82f6',    // blue
  J3: '#22c55e',    // green
  J5: '#a855f7',    // purple
  CDR: '#f59e0b',   // gold
  XO: '#f97316',    // orange
  J1: '#ec4899',    // pink
  J4: '#14b8a6',    // teal
  J6: '#6366f1',    // indigo
  default: '#6b7280', // gray fallback
};

export function getRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? ROLE_COLORS.default;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDesignInterview(problemSetId: string): UseDesignInterviewResult {
  const { userDID, displayName } = useUser();
  const { userRoleInActive } = useProblemSet();

  const [interviewState, setInterviewState] = useState<DesignInterviewMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [directedRole, setDirectedRole] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Map<string, string>>(new Map());
  const mountedRef = useRef(true);
  // Stable anon DID fallback (only used when userDID is null)
  const anonDidRef = useRef(`anon-${Math.random().toString(36).slice(2, 8)}`);

  // Derive computed state
  const isActive = interviewState !== null && !interviewState.isComplete;
  const awaitingConfirm = interviewState !== null &&
    interviewState.sectionCoverage[interviewState.currentSection]?.met === true;
  const isCollaborative = participants.size > 1;
  const currentUserRole = userRoleInActive;
  const isMyTurn = isActive && directedRole !== null && currentUserRole !== null && currentUserRole === directedRole;

  // ---------------------------------------------------------------------------
  // Yjs collaborative state (only when user is authenticated and interview active)
  // ---------------------------------------------------------------------------

  const yjsUser = {
    did: userDID ?? anonDidRef.current,
    name: displayName ?? 'Unknown',
    role: userRoleInActive ?? 'Observer',
    color: getRoleColor(userRoleInActive ?? ''),
  };

  const documentId = `design-interview-${problemSetId}`;

  const { getMap, connected } = useYjsDocument({
    documentId,
    planId: problemSetId,
    user: yjsUser,
  });

  // ---------------------------------------------------------------------------
  // Sync local interview state → Yjs interviewState map (when we get API updates)
  // ---------------------------------------------------------------------------

  const syncStateToYjs = useCallback((state: DesignInterviewMeta | null, message: string | null, directed: string | null) => {
    const stateMap = getMap<unknown>('interviewState');
    if (!stateMap) return;
    if (state) {
      stateMap.set('currentSection', state.currentSection);
      stateMap.set('sectionCoverage', state.sectionCoverage as unknown);
      stateMap.set('questionsAsked', state.questionsAsked);
      stateMap.set('isComplete', state.isComplete);
      stateMap.set('interviewMode', state.interviewMode);
    }
    if (message !== null) {
      stateMap.set('lastMessage', message);
    }
    if (directed !== null) {
      stateMap.set('directedRole', directed);
    }
  }, [getMap]);

  // ---------------------------------------------------------------------------
  // Track participants in Yjs participantRoles map
  // ---------------------------------------------------------------------------

  // Register self in participantRoles on connect, observe map for changes
  useEffect(() => {
    if (!connected || !problemSetId) return;

    const participantRolesMap = getMap<string>('participantRoles');
    if (!participantRolesMap) return;

    const myDid = yjsUser.did;
    const myRole = yjsUser.role;

    // Register self
    participantRolesMap.set(myDid, myRole);

    // Observe changes and update local participants state
    const observer = () => {
      const newParticipants = new Map<string, string>();
      participantRolesMap.forEach((role, did) => {
        newParticipants.set(did, role);
      });
      if (mountedRef.current) {
        setParticipants(newParticipants);
      }
    };

    // Initial read
    observer();

    participantRolesMap.observe(observer);

    return () => {
      participantRolesMap.unobserve(observer);
      // Remove self from participants on unmount
      if (participantRolesMap.doc) {
        participantRolesMap.doc.transact(() => {
          participantRolesMap.delete(myDid);
        });
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reconnect only on identity/doc changes
  }, [connected, problemSetId, yjsUser.did, yjsUser.role, getMap]);

  // ---------------------------------------------------------------------------
  // Observe Yjs interviewState map for remote updates from other participants
  // ---------------------------------------------------------------------------

  useEffect(() => {
    if (!connected) return;

    const stateMap = getMap<unknown>('interviewState');
    if (!stateMap) return;

    const observer = (event: Y.YMapEvent<unknown>) => {
      // Only react to remote changes (not our own)
      if (event.transaction.local) return;

      const currentSection = stateMap.get('currentSection') as DesignInterviewMeta['currentSection'] | undefined;
      const sectionCoverage = stateMap.get('sectionCoverage') as Record<string, SectionCoverage> | undefined;
      const questionsAsked = stateMap.get('questionsAsked') as number | undefined;
      const isComplete = stateMap.get('isComplete') as boolean | undefined;
      const interviewMode = stateMap.get('interviewMode') as 'new' | 'revision' | undefined;
      const remoteLastMessage = stateMap.get('lastMessage') as string | undefined;
      const remoteDirectedRole = stateMap.get('directedRole') as string | undefined;

      if (currentSection && sectionCoverage !== undefined && questionsAsked !== undefined && isComplete !== undefined && interviewMode) {
        if (mountedRef.current) {
          setInterviewState({
            currentSection,
            sectionCoverage: sectionCoverage ?? {},
            questionsAsked: questionsAsked ?? 0,
            isComplete: isComplete ?? false,
            interviewMode,
          });
        }
      }
      if (remoteLastMessage !== undefined && mountedRef.current) {
        setLastMessage(remoteLastMessage);
      }
      if (remoteDirectedRole !== undefined && mountedRef.current) {
        setDirectedRole(remoteDirectedRole);
      }
    };

    stateMap.observe(observer);
    return () => stateMap.unobserve(observer);
  }, [connected, getMap]);

  // ---------------------------------------------------------------------------
  // Resume on mount — check for existing interview state
  // ---------------------------------------------------------------------------

  useEffect(() => {
    mountedRef.current = true;
    if (!problemSetId) return;

    (async () => {
      try {
        const res = await fetch(`/api/design-interview/${problemSetId}/state`);
        if (!res.ok) return;
        const data = await res.json() as { state: DesignInterviewMeta | null };
        if (mountedRef.current && data.state) {
          setInterviewState(data.state);
        }
      } catch {
        // Silent — no interview to resume
      }
    })();

    return () => { mountedRef.current = false; };
  }, [problemSetId]);

  // ---------------------------------------------------------------------------
  // Get current participant roles snapshot for API calls
  // ---------------------------------------------------------------------------

  const getParticipantRolesSnapshot = useCallback((): Record<string, string> => {
    const snap: Record<string, string> = {};
    participants.forEach((role, did) => { snap[did] = role; });
    // Always include self
    if (userDID) snap[userDID] = userRoleInActive ?? 'Observer';
    return snap;
  }, [participants, userDID, userRoleInActive]);

  // ---------------------------------------------------------------------------
  // API calls
  // ---------------------------------------------------------------------------

  const startInterview = useCallback(async (mode: 'new' | 'revision' = 'new') => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          participantRoles: getParticipantRolesSnapshot(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta; directedRole?: string };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
        setDirectedRole(data.directedRole ?? null);
        syncStateToYjs(data.state, data.message, data.directedRole ?? null);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId, getParticipantRolesSnapshot, syncStateToYjs]);

  const sendMessage = useCallback(async (message: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/continue`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          participantRoles: getParticipantRolesSnapshot(),
        }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta; directedRole?: string };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
        setDirectedRole(data.directedRole ?? null);
        syncStateToYjs(data.state, data.message, data.directedRole ?? null);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId, getParticipantRolesSnapshot, syncStateToYjs]);

  const confirmSection = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}/confirm-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({ error: 'Request failed' })) as { error: string };
        throw new Error(errBody.error);
      }
      const data = await res.json() as { message: string; state: DesignInterviewMeta; directedRole?: string };
      if (mountedRef.current) {
        setInterviewState(data.state);
        setLastMessage(data.message);
        setDirectedRole(data.directedRole ?? null);
        syncStateToYjs(data.state, data.message, data.directedRole ?? null);
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId, syncStateToYjs]);

  const resetInterview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/design-interview/${problemSetId}`, {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        throw new Error('Failed to reset interview');
      }
      if (mountedRef.current) {
        setInterviewState(null);
        setLastMessage(null);
        setDirectedRole(null);
        // Clear Yjs state map
        const stateMap = getMap<unknown>('interviewState');
        if (stateMap) {
          stateMap.clear();
        }
      }
    } catch (err) {
      if (mountedRef.current) setError((err as Error).message);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [problemSetId, getMap]);

  return {
    interviewState,
    isActive,
    isLoading,
    lastMessage,
    error,
    startInterview,
    sendMessage,
    confirmSection,
    resetInterview,
    awaitingConfirm,
    participants,
    isCollaborative,
    directedRole,
    currentUserRole,
    isMyTurn,
  };
}
