/**
 * ModeConfirmationModal
 *
 * Confirmation dialog shown before switching between training
 * and operational modes. Warns the user about the implications
 * of the mode change.
 */

import { useState } from 'react';
import type { AppMode } from '../context/ModeContext';

interface ModeConfirmationModalProps {
  targetMode: AppMode;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 10000,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'rgba(0, 0, 0, 0.6)',
};

const cardStyle: React.CSSProperties = {
  background: '#1e1e2e',
  border: '1px solid rgba(255, 255, 255, 0.15)',
  borderRadius: '12px',
  padding: '24px',
  maxWidth: '420px',
  width: '90%',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
};

const titleStyle: React.CSSProperties = {
  fontSize: '1.1rem',
  fontWeight: 600,
  color: '#f9fafb',
  marginBottom: '12px',
};

const messageStyle: React.CSSProperties = {
  fontSize: '0.9rem',
  color: '#9ca3af',
  lineHeight: 1.5,
  marginBottom: '20px',
};

const buttonRowStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: '10px',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  border: '1px solid rgba(255, 255, 255, 0.2)',
  borderRadius: '8px',
  color: '#d1d5db',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 500,
};

const confirmBtnBase: React.CSSProperties = {
  padding: '8px 16px',
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer',
  fontSize: '13px',
  fontWeight: 600,
};

export function ModeConfirmationModal({ targetMode, onConfirm, onCancel }: ModeConfirmationModalProps) {
  const [confirming, setConfirming] = useState(false);

  const isToOperational = targetMode === 'operational';

  const title = isToOperational
    ? 'Switch to Operational Mode'
    : 'Switch to Training Mode';

  const message = isToOperational
    ? 'You are switching to OPERATIONAL mode. All actions will affect live data. Confirm?'
    : 'You are switching to TRAINING mode. All actions will use exercise data. Confirm?';

  const confirmBtnStyle: React.CSSProperties = {
    ...confirmBtnBase,
    background: isToOperational ? '#dc2626' : '#D97706',
    color: isToOperational ? '#fff' : '#000',
  };

  async function handleConfirm() {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={titleStyle}>{title}</div>
        <div style={messageStyle}>{message}</div>
        <div style={buttonRowStyle}>
          <button style={cancelBtnStyle} onClick={onCancel} disabled={confirming}>
            Cancel
          </button>
          <button
            style={confirmBtnStyle}
            onClick={handleConfirm}
            disabled={confirming}
          >
            {confirming ? 'Switching...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
