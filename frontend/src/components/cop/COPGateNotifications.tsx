/**
 * COPGateNotifications
 *
 * Overlay component for the COP map that surfaces decision gate notifications:
 *
 *   1. **Critical (lethal force)**: Full-screen modal with flashing border,
 *      threat details, approve/reject buttons. Auto-zooms map to action area.
 *
 *   2. **High (resource allocation)**: Slide-in toast at bottom-right with
 *      approve/dismiss and link to Direct tab.
 *
 * Designed to capture commander attention during live operations.
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useCOPGateNotifications,
  type GateNotification,
} from '../../hooks/useCOPGateNotifications.js';

// ─── Props ──────────────────────────────────────────────────────────────────

interface COPGateNotificationsProps {
  /** Callback to zoom the map to a specific area when a critical gate arrives */
  onZoomToAction?: (lat: number, lng: number, zoom: number) => void;
  /** Problem set ID for navigation */
  problemSetId?: string;
}

// ─── Calibration (must match calibration-profiles.json) ─────────────────────

const CAL_SOUTH = 25.0420, CAL_NORTH = 25.0480;
const CAL_WEST = 121.5120, CAL_EAST = 121.5180;
const CAL_ROOM_W = 5, CAL_ROOM_H = 5;

function roomToLatLng(x: number, y: number): [number, number] {
  return [
    CAL_SOUTH + (y / CAL_ROOM_H) * (CAL_NORTH - CAL_SOUTH),
    CAL_WEST + (x / CAL_ROOM_W) * (CAL_EAST - CAL_WEST),
  ];
}

// ─── Component ──────────────────────────────────────────────────────────────

export function COPGateNotifications({ onZoomToAction, problemSetId }: COPGateNotificationsProps) {
  const navigate = useNavigate();
  const {
    criticalGate,
    toastNotifications,
    approveGate,
    rejectGate,
    dismissNotification,
  } = useCOPGateNotifications();

  const handleViewInDirect = useCallback((id: string) => {
    dismissNotification(id);
    if (problemSetId) {
      navigate(`/problem-set/${problemSetId}/direct`);
    }
  }, [dismissNotification, problemSetId, navigate]);

  // Auto-zoom map when a critical gate arrives
  useEffect(() => {
    if (criticalGate && onZoomToAction) {
      // Zoom to the engagement area center (approximate from room coords)
      // The action is happening in the north part of the AO near Zhongxiao W Rd
      const [lat, lng] = roomToLatLng(2.5, 3.5);
      onZoomToAction(lat, lng, 17);
    }
  }, [criticalGate, onZoomToAction]);

  return (
    <>
      {/* Critical: Lethal force authorization modal */}
      {criticalGate && (
        <LethalAuthModal
          gate={criticalGate}
          onApprove={approveGate}
          onReject={rejectGate}
        />
      )}

      {/* High: Toast notifications */}
      {toastNotifications.length > 0 && (
        <ToastStack
          notifications={toastNotifications}
          onApprove={approveGate}
          onDismiss={dismissNotification}
          onViewInDirect={handleViewInDirect}
        />
      )}
    </>
  );
}

// ─── Lethal Force Authorization Modal ───────────────────────────────────────

function LethalAuthModal({
  gate,
  onApprove,
  onReject,
}: {
  gate: GateNotification;
  onApprove: (gateId: string) => Promise<void>;
  onReject: (gateId: string, reason: string) => Promise<void>;
}) {
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  // Elapsed timer
  useEffect(() => {
    const start = Date.now();
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [gate.gateId]);

  const handleApprove = useCallback(async () => {
    setActing(true);
    await onApprove(gate.gateId);
    setActing(false);
  }, [gate.gateId, onApprove]);

  const handleReject = useCallback(async () => {
    setActing(true);
    await onReject(gate.gateId, 'Commander denied lethal force');
    setActing(false);
  }, [gate.gateId, onReject]);

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      zIndex: 2000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      backdropFilter: 'blur(4px)',
      animation: 'cop-gate-overlay-pulse 2s ease-in-out infinite',
    }}>
      <style>{`
        @keyframes cop-gate-overlay-pulse {
          0%, 100% { background-color: rgba(0, 0, 0, 0.7); }
          50% { background-color: rgba(127, 29, 29, 0.5); }
        }
        @keyframes cop-gate-border-flash {
          0%, 100% { border-color: rgba(239, 68, 68, 0.8); box-shadow: 0 0 30px rgba(239, 68, 68, 0.3); }
          50% { border-color: rgba(239, 68, 68, 0.3); box-shadow: 0 0 10px rgba(239, 68, 68, 0.1); }
        }
      `}</style>

      <div style={{
        backgroundColor: 'rgba(17, 24, 39, 0.98)',
        border: '2px solid rgba(239, 68, 68, 0.8)',
        borderRadius: '12px',
        padding: '24px 32px',
        maxWidth: '480px',
        width: '90%',
        animation: 'cop-gate-border-flash 1.5s ease-in-out infinite',
      }}>
        {/* Header with warning icon */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '16px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
              <path d="M12 9v4m0 4h.01M10.29 3.86l-8.6 14.5A1 1 0 002.58 20h16.84a1 1 0 00.87-1.5l-8.6-14.5a1 1 0 00-1.72 0z" />
            </svg>
          </div>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '1rem',
              fontWeight: 700,
              color: '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Lethal Force Authorization
            </h2>
            <span style={{
              fontSize: '0.6875rem',
              color: '#9ca3af',
            }}>
              URGENT — Awaiting commander decision ({elapsed}s)
            </span>
          </div>
        </div>

        {/* Gate details */}
        <div style={{
          backgroundColor: 'rgba(31, 41, 55, 0.5)',
          borderRadius: '8px',
          padding: '12px 16px',
          marginBottom: '16px',
          border: '1px solid #374151',
        }}>
          <div style={{ fontSize: '0.8125rem', color: '#e5e7eb', marginBottom: '8px' }}>
            {gate.title}
          </div>
          {gate.threatDesignation && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '0.75rem',
              color: '#fca5a5',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
              }} />
              Target: {gate.threatDesignation}
            </div>
          )}
          <div style={{
            fontSize: '0.625rem',
            color: '#6b7280',
            marginTop: '6px',
            fontFamily: "'Fira Code', monospace",
          }}>
            Gate: {gate.gateId.slice(0, 12)}...
          </div>
        </div>

        {/* Smart contract note */}
        <div style={{
          fontSize: '0.625rem',
          color: '#9ca3af',
          marginBottom: '16px',
          padding: '8px 12px',
          backgroundColor: 'rgba(249, 115, 22, 0.08)',
          border: '1px solid rgba(249, 115, 22, 0.2)',
          borderRadius: '6px',
        }}>
          Autonomous engagement blocked by DID smart contract policy.
          Decision will be recorded on NEAR blockchain for audit trail.
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={handleApprove}
            disabled={acting}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '2px solid rgba(239, 68, 68, 0.6)',
              backgroundColor: acting ? 'rgba(127, 29, 29, 0.3)' : 'rgba(239, 68, 68, 0.15)',
              color: '#fca5a5',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: acting ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.15s',
            }}
          >
            {acting ? 'Processing...' : 'Authorize'}
          </button>

          <button
            onClick={handleReject}
            disabled={acting}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '8px',
              border: '1px solid #374151',
              backgroundColor: 'rgba(31, 41, 55, 0.5)',
              color: '#9ca3af',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: acting ? 'not-allowed' : 'pointer',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              transition: 'all 0.15s',
            }}
          >
            Deny
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast Notification Stack ───────────────────────────────────────────────

function ToastStack({
  notifications,
  onApprove,
  onDismiss,
  onViewInDirect,
}: {
  notifications: GateNotification[];
  onApprove: (gateId: string) => Promise<void>;
  onDismiss: (id: string) => void;
  onViewInDirect: (id: string) => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      bottom: '16px',
      right: '16px',
      zIndex: 1500,
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      maxWidth: '340px',
    }}>
      {notifications.slice(0, 3).map((n) => (
        <Toast key={n.id} notification={n} onApprove={onApprove} onDismiss={onDismiss} onViewInDirect={onViewInDirect} />
      ))}
    </div>
  );
}

function Toast({
  notification,
  onApprove,
  onDismiss,
  onViewInDirect,
}: {
  notification: GateNotification;
  onApprove: (gateId: string) => Promise<void>;
  onDismiss: (id: string) => void;
  onViewInDirect: (id: string) => void;
}) {
  const [acting, setActing] = useState(false);

  // Decision notifications persist until the approval authority acts on them.
  // No auto-dismiss — these require explicit action.

  const handleApprove = useCallback(async () => {
    setActing(true);
    await onApprove(notification.gateId);
  }, [notification.gateId, onApprove]);

  return (
    <div style={{
      backgroundColor: 'rgba(17, 24, 39, 0.95)',
      border: '1px solid rgba(245, 158, 11, 0.4)',
      borderRadius: '8px',
      padding: '10px 14px',
      backdropFilter: 'blur(8px)',
      animation: 'cop-toast-slide 0.3s ease-out',
    }}>
      <style>{`
        @keyframes cop-toast-slide {
          from { opacity: 0; transform: translateX(20px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: '8px',
        marginBottom: '6px',
      }}>
        <div style={{ flex: 1 }}>
          <div style={{
            fontSize: '0.5625rem',
            color: '#f59e0b',
            textTransform: 'uppercase',
            fontWeight: 600,
            letterSpacing: '0.3px',
            marginBottom: '2px',
          }}>
            Decision Required
          </div>
          <div style={{ fontSize: '0.6875rem', color: '#e5e7eb' }}>
            {notification.title}
          </div>
        </div>
        <button
          onClick={() => onDismiss(notification.id)}
          style={{
            background: 'none',
            border: 'none',
            color: '#6b7280',
            cursor: 'pointer',
            fontSize: '0.75rem',
            padding: '2px',
            lineHeight: 1,
          }}
        >
          x
        </button>
      </div>

      <div style={{ display: 'flex', gap: '6px' }}>
        <button
          onClick={handleApprove}
          disabled={acting}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: '1px solid rgba(34, 197, 94, 0.4)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            color: '#86efac',
            fontSize: '0.625rem',
            fontWeight: 600,
            cursor: acting ? 'not-allowed' : 'pointer',
          }}
        >
          Approve
        </button>
        <button
          onClick={() => onViewInDirect(notification.id)}
          style={{
            padding: '4px 12px',
            borderRadius: '4px',
            border: '1px solid #374151',
            backgroundColor: 'transparent',
            color: '#9ca3af',
            fontSize: '0.625rem',
            cursor: 'pointer',
          }}
        >
          View in Direct
        </button>
      </div>
    </div>
  );
}
