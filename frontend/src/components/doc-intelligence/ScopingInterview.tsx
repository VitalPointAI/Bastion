/**
 * ScopingInterview - Conversational chat UI for problem set scoping
 *
 * Chat-style interface for the adaptive scoping interview that captures
 * geographic scope, temporal range, actor focus, core problem, and more.
 *
 * Features:
 * - Scrollable message history (AI left-aligned, user right-aligned)
 * - Text input with send button
 * - Audio input via Web Speech API (graceful fallback)
 * - Resume from LangGraph checkpoint on refresh
 * - Progress indicator for covered interview categories
 * - "Confirm & Save" button when interview is complete
 * - Re-run banner when updating existing scope
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ============================================================================
// Types
// ============================================================================

/** Problem set context shape (matches backend ProblemSetContext) */
interface ProblemSetContext {
  problemSetId: string;
  geographicScope: {
    regions: string[];
    countries: string[];
    specificAreas?: string[];
    exclusions?: string[];
  };
  temporalRange: {
    startDate?: string;
    endDate?: string;
    historicalDepth?: string;
    futureHorizon?: string;
  };
  actorFocus: {
    primaryActors: string[];
    alliances?: Array<{ name: string; members: string[] }>;
    excludedActors?: string[];
  };
  coreProblem: string;
  additionalNuance?: string;
  classificationCeiling: 'UNCLASSIFIED' | 'SECRET' | 'TOPSECRET';
  echelon: 'strategic' | 'operational' | 'tactical';
  standingRequirements?: string[];
  updatedAt: string;
  version: number;
}

interface ScopingInterviewProps {
  problemSetId: string;
  onComplete: (context: ProblemSetContext) => void;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface InterviewState {
  questionsAsked: number;
  isComplete: boolean;
  derivedContext: Record<string, unknown>;
}

// ============================================================================
// API helpers
// ============================================================================

const API_BASE = '/api/doc-intelligence';

async function apiStartInterview(problemSetId: string) {
  const res = await fetch(`${API_BASE}/interview/${problemSetId}/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function apiSendMessage(problemSetId: string, message: string) {
  const res = await fetch(`${API_BASE}/interview/${problemSetId}/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  });
  return res.json();
}

async function apiGetState(problemSetId: string) {
  const res = await fetch(`${API_BASE}/interview/${problemSetId}/state`);
  return res.json();
}

async function apiCompleteInterview(problemSetId: string) {
  const res = await fetch(`${API_BASE}/interview/${problemSetId}/complete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  return res.json();
}

async function apiGetContext(problemSetId: string) {
  const res = await fetch(`${API_BASE}/context/${problemSetId}`);
  return res.json();
}

// ============================================================================
// Interview categories for progress tracking
// ============================================================================

const CATEGORY_LABELS: Record<string, string> = {
  geographicScope: 'Geographic Scope',
  temporalRange: 'Temporal Range',
  actorFocus: 'Actor Focus',
  coreProblem: 'Core Problem',
  classificationCeiling: 'Classification',
  echelon: 'Echelon',
  standingRequirements: 'Standing Requirements',
  additionalNuance: 'Additional Nuance',
};

function isCategoryCovered(key: string, derivedContext: Record<string, unknown>): boolean {
  const value = derivedContext[key];
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.values(obj).some((v) => {
      if (Array.isArray(v)) return v.length > 0;
      if (typeof v === 'string') return v.trim().length > 0;
      return v !== null && v !== undefined;
    });
  }
  return true;
}

// ============================================================================
// Speech Recognition helper
// ============================================================================

function getSpeechRecognition(): SpeechRecognition | null {
  const SR =
    (window as unknown as Record<string, unknown>).SpeechRecognition ||
    (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
  if (!SR) return null;
  return new (SR as new () => SpeechRecognition)();
}

// ============================================================================
// Component
// ============================================================================

export function ScopingInterview({ problemSetId, onComplete, onClose }: ScopingInterviewProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [interviewState, setInterviewState] = useState<InterviewState>({
    questionsAsked: 0,
    isComplete: false,
    derivedContext: {},
  });
  const [completing, setCompleting] = useState(false);
  const [isRerun, setIsRerun] = useState(false);
  const [recording, setRecording] = useState(false);
  const [speechSupported] = useState(() => getSpeechRecognition() !== null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mountedRef = useRef(true);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  // Initialize: check for existing state (resume) or start new interview
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setLoading(true);
      setError(null);

      try {
        // Check if there's already a context (re-run detection)
        const contextRes = await apiGetContext(problemSetId);
        if (contextRes.success && contextRes.context) {
          setIsRerun(true);
        }

        // Check for existing interview state (resume)
        const stateRes = await apiGetState(problemSetId);
        if (cancelled) return;

        if (stateRes.success && stateRes.state && stateRes.state.messages?.length > 0) {
          // Resume: restore messages and state
          const restored: ChatMessage[] = stateRes.state.messages.map(
            (msg: { role: string; content: string }, i: number) => ({
              id: `restored-${i}`,
              role: msg.role as 'user' | 'assistant',
              content: msg.content,
              timestamp: new Date().toISOString(),
            })
          );
          setMessages(restored);
          setInterviewState({
            questionsAsked: stateRes.state.questionsAsked,
            isComplete: stateRes.state.isComplete,
            derivedContext: stateRes.state.derivedContext,
          });
        } else {
          // Start new interview
          const startRes = await apiStartInterview(problemSetId);
          if (cancelled) return;

          if (startRes.success && startRes.message) {
            setMessages([
              {
                id: `ai-${Date.now()}`,
                role: 'assistant',
                content: startRes.message.content,
                timestamp: new Date().toISOString(),
              },
            ]);
            if (startRes.state) {
              setInterviewState(startRes.state);
            }
          } else {
            setError(startRes.error || 'Failed to start interview');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to initialize interview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [problemSetId]);

  // Send a message
  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);

    try {
      const res = await apiSendMessage(problemSetId, trimmed);

      if (!mountedRef.current) return;

      if (res.success && res.message) {
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: res.message.content,
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, aiMsg]);
        if (res.state) {
          setInterviewState(res.state);
        }
      } else {
        setError(res.error || 'Failed to get response');
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to send message');
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [input, loading, problemSetId]);

  // Handle key press (Enter to send)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  // Audio input via Web Speech API
  const toggleRecording = useCallback(() => {
    if (recording) {
      recognitionRef.current?.stop();
      setRecording(false);
      return;
    }

    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? '';
      if (transcript) {
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
      }
      setRecording(false);
    };

    recognition.onerror = () => {
      setRecording(false);
    };

    recognition.onend = () => {
      setRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }, [recording]);

  // Complete interview
  const handleComplete = useCallback(async () => {
    setCompleting(true);
    setError(null);

    try {
      const res = await apiCompleteInterview(problemSetId);

      if (res.success && res.context) {
        onComplete(res.context);
      } else {
        setError(res.error || 'Failed to complete interview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete interview');
    } finally {
      if (mountedRef.current) setCompleting(false);
    }
  }, [problemSetId, onComplete]);

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Problem Set Scoping Interview</h2>
          <p className="text-sm text-muted-foreground">
            Define the boundaries for intelligence analysis
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-secondary text-muted-foreground"
          aria-label="Close interview"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Re-run banner */}
      {isRerun && (
        <div className="px-4 py-2 bg-amber-500/10 border-b border-amber-500/20">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Updating scope will apply to future processing. Existing analysis remains unchanged.
          </p>
        </div>
      )}

      {/* Progress indicator */}
      <div className="px-4 py-2 border-b border-border">
        <div className="flex flex-wrap gap-2">
          {Object.entries(CATEGORY_LABELS).map(([key, label]) => {
            const covered = isCategoryCovered(key, interviewState.derivedContext);
            return (
              <span
                key={key}
                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                  covered
                    ? 'bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-secondary text-muted-foreground'
                }`}
              >
                {covered && (
                  <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
                {label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Message history */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {loading && messages.length > 0 && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-lg px-4 py-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Complete button (when interview is done) */}
      {interviewState.isComplete && (
        <div className="px-4 py-3 border-t border-border">
          <button
            onClick={handleComplete}
            disabled={completing}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {completing ? 'Saving...' : 'Confirm & Save'}
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="px-4 py-3 border-t border-border">
        <div className="flex items-center gap-2">
          {/* Audio input button */}
          {speechSupported && (
            <button
              onClick={toggleRecording}
              className={`p-2 rounded-lg transition-colors ${
                recording
                  ? 'bg-red-500 text-white animate-pulse'
                  : 'bg-secondary text-muted-foreground hover:text-foreground'
              }`}
              aria-label={recording ? 'Stop recording' : 'Start voice input'}
              title={recording ? 'Stop recording' : 'Voice input'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
          )}

          {/* Text input */}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={recording ? 'Listening...' : 'Type your response...'}
            disabled={loading || completing}
            className="flex-1 px-3 py-2 bg-secondary border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50"
          />

          {/* Send button */}
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading || completing}
            className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Send message"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
