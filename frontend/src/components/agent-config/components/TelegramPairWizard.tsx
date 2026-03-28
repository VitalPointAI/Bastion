/**
 * TelegramPairWizard
 *
 * Phase 60 Plan 05: 3-step wizard for pairing a user's Telegram account with
 * their Ironclaw Chief of Staff instance.
 *
 * Blueprint Section 4.3 — Telegram notifications enable multi-channel routing
 * so CRITICAL alerts reach the user even when away from the Bastion dashboard.
 *
 * Steps:
 *   1. Initiate — explain process, call /api/agent-config/:userId/telegram-pair
 *   2. Enter Code — user receives 6-digit code from Telegram bot
 *   3. Complete — call /api/agent-config/:userId/telegram-confirm with code
 *
 * Error handling: timeout (5min), invalid code, network errors.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 'initiate' | 'enter-code' | 'complete';

interface TelegramPairWizardProps {
  /** NEAR account ID of the user (used in API paths). */
  userId: string;
  /** Called when pairing succeeds with the chat ID returned by the server. */
  onSuccess: (chatId: string) => void;
  /** Called when the wizard is dismissed without pairing. */
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Pairing code expiry: 5 minutes in milliseconds. */
const CODE_TIMEOUT_MS = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TelegramPairWizard({ userId, onSuccess, onCancel }: TelegramPairWizardProps) {
  const [step, setStep] = useState<WizardStep>('initiate');
  const [code, setCode] = useState('');
  const [telegramUsername, setTelegramUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  // Timer ref for code expiry
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expiryRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Countdown effect when on enter-code step
  useEffect(() => {
    if (step === 'enter-code' && expiryRef.current) {
      clearTimer();
      timerRef.current = setInterval(() => {
        const remaining = expiryRef.current! - Date.now();
        if (remaining <= 0) {
          clearTimer();
          setTimeLeft(0);
          setError('Pairing code expired. Please start the process again.');
        } else {
          setTimeLeft(Math.ceil(remaining / 1000));
        }
      }, 1000);
    }
    return clearTimer;
  }, [step]);

  // ---------------------------------------------------------------------------
  // Step 1: Initiate pairing
  // ---------------------------------------------------------------------------

  const handleInitiate = useCallback(async () => {
    const trimmedUsername = telegramUsername.trim().replace(/^@/, '');
    if (!trimmedUsername) {
      setError('Please enter your Telegram username.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agent-config/${encodeURIComponent(userId)}/telegram-pair`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUsername: trimmedUsername }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error: ${res.status}`);
      }

      // Start expiry timer
      expiryRef.current = Date.now() + CODE_TIMEOUT_MS;
      setTimeLeft(CODE_TIMEOUT_MS / 1000);
      setStep('enter-code');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to initiate pairing');
    } finally {
      setLoading(false);
    }
  }, [userId, telegramUsername]);

  // ---------------------------------------------------------------------------
  // Step 2: Confirm code
  // ---------------------------------------------------------------------------

  const handleConfirm = useCallback(async () => {
    const trimmedCode = code.trim();
    if (!trimmedCode || trimmedCode.length < 4) {
      setError('Please enter the 6-digit code from Telegram.');
      return;
    }

    if (timeLeft === 0) {
      setError('Code has expired. Please start again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/agent-config/${encodeURIComponent(userId)}/telegram-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmedCode }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? `Server error: ${res.status}`);
      }

      const data = await res.json() as { chatId?: string };
      clearTimer();
      setStep('complete');

      if (data.chatId) {
        onSuccess(data.chatId);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to confirm pairing code');
    } finally {
      setLoading(false);
    }
  }, [userId, code, timeLeft, onSuccess]);

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  const formatTimeLeft = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-4 max-w-sm w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.96 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
          </svg>
          <span className="text-sm font-semibold text-slate-200">Pair Telegram</span>
        </div>
        <button
          onClick={() => {
            clearTimer();
            onCancel();
          }}
          className="text-slate-500 hover:text-slate-300 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-1 mb-4">
        {(['initiate', 'enter-code', 'complete'] as WizardStep[]).map((s, i) => {
          const isActive = step === s;
          const isDone =
            (s === 'initiate' && (step === 'enter-code' || step === 'complete')) ||
            (s === 'enter-code' && step === 'complete');
          return (
            <div key={s} className="flex items-center gap-1">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isDone
                    ? 'bg-emerald-600 text-white'
                    : isActive
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-700 text-slate-500'
                }`}
              >
                {isDone ? (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div className={`h-px w-8 ${isDone ? 'bg-emerald-600' : 'bg-slate-700'}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-3 px-3 py-2 bg-red-900/20 border border-red-700/40 rounded text-xs text-red-300">
          {error}
        </div>
      )}

      {/* Step content */}
      {step === 'initiate' && (
        <div>
          <h3 className="text-sm font-medium text-slate-200 mb-2">Step 1: Initiate Pairing</h3>
          <p className="text-xs text-slate-400 mb-3">
            The Bastion bot will send a pairing code to your Telegram account.
            Make sure you have started a conversation with the bot before proceeding.
          </p>
          <ol className="text-xs text-slate-400 list-decimal pl-4 mb-3 space-y-1">
            <li>Open Telegram and search for <span className="font-mono text-slate-300">@BastionIronclawBot</span></li>
            <li>Send the bot the message <span className="font-mono text-slate-300">/start</span></li>
            <li>Enter your Telegram username below and click "Start Pairing"</li>
          </ol>
          <input
            type="text"
            value={telegramUsername}
            onChange={(e) => setTelegramUsername(e.target.value)}
            placeholder="@your_telegram_username"
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 mb-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && telegramUsername.trim()) void handleInitiate();
            }}
          />
          <div className="flex gap-2">
            <button
              onClick={() => void handleInitiate()}
              disabled={loading || !telegramUsername.trim()}
              className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
            >
              {loading ? 'Sending...' : 'Start Pairing'}
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {step === 'enter-code' && (
        <div>
          <h3 className="text-sm font-medium text-slate-200 mb-2">Step 2: Enter Code</h3>
          <p className="text-xs text-slate-400 mb-3">
            Check your Telegram — the bot should have sent you a 6-digit pairing
            code. Enter it below to complete the connection.
          </p>

          {timeLeft !== null && timeLeft > 0 && (
            <div className="text-[11px] text-amber-400 mb-2">
              Code expires in {formatTimeLeft(timeLeft)}
            </div>
          )}

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="Enter 6-digit code"
            maxLength={6}
            autoFocus
            className="w-full bg-slate-900 border border-slate-600 rounded px-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500 text-center tracking-[0.4em] font-mono mb-3"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.length === 6) void handleConfirm();
            }}
          />

          <div className="flex gap-2">
            <button
              onClick={() => {
                clearTimer();
                setStep('initiate');
                setCode('');
                setError(null);
              }}
              className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs rounded transition-colors"
            >
              Back
            </button>
            <button
              onClick={() => void handleConfirm()}
              disabled={loading || code.length < 4 || timeLeft === 0}
              className="flex-1 py-2 bg-blue-700 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded transition-colors"
            >
              {loading ? 'Verifying...' : 'Confirm Code'}
            </button>
          </div>

          <div className="mt-2 text-center">
            <button
              onClick={() => {
                clearTimer();
                void handleInitiate();
              }}
              className="text-[11px] text-slate-500 hover:text-slate-400 underline transition-colors"
            >
              Resend code
            </button>
          </div>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center py-2">
          <div className="w-10 h-10 bg-emerald-600/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-emerald-400 mb-1">Telegram Paired</h3>
          <p className="text-xs text-slate-400">
            Ironclaw will now send you notifications via Telegram based on your
            configured notification level.
          </p>
        </div>
      )}
    </div>
  );
}
