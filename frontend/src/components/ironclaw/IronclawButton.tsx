/**
 * IronclawButton -- Floating trigger button
 *
 * Fixed position, draggable to reposition. Position persisted in localStorage.
 * z-index 950 (above AI staff 900, below modals 1000+).
 */

import { useState, useRef, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'ironclaw-button-position';
const DEFAULT_BOTTOM = 20;
const DEFAULT_RIGHT = 20;
const BUTTON_SIZE = 56;

interface Position { bottom: number; right: number }

function loadPosition(): Position {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const pos = JSON.parse(raw);
      if (typeof pos.bottom === 'number' && typeof pos.right === 'number') {
        return pos;
      }
    }
  } catch { /* use default */ }
  return { bottom: DEFAULT_BOTTOM, right: DEFAULT_RIGHT };
}

function savePosition(pos: Position): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(pos)); } catch { /* ignore */ }
}

interface IronclawButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function IronclawButton({ onClick, hasUnread }: IronclawButtonProps) {
  const [position, setPosition] = useState<Position>(loadPosition);
  const dragging = useRef(false);
  const dragMoved = useRef(false);
  const startMouse = useRef({ x: 0, y: 0 });
  const startPos = useRef({ bottom: 0, right: 0 });

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    dragging.current = true;
    dragMoved.current = false;
    startMouse.current = { x: e.clientX, y: e.clientY };
    startPos.current = { ...position };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - startMouse.current.x;
    const dy = e.clientY - startMouse.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragMoved.current = true;
    if (!dragMoved.current) return;

    const newRight = Math.max(0, Math.min(window.innerWidth - BUTTON_SIZE, startPos.current.right - dx));
    const newBottom = Math.max(0, Math.min(window.innerHeight - BUTTON_SIZE, startPos.current.bottom + dy));
    setPosition({ bottom: newBottom, right: newRight });
  }, []);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    dragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);

    if (dragMoved.current) {
      // Save new position — don't fire onClick
      savePosition(position);
    } else {
      onClick();
    }
  }, [onClick, position]);

  // Clamp on window resize
  useEffect(() => {
    const onResize = () => {
      setPosition((prev) => {
        const clamped = {
          right: Math.min(prev.right, window.innerWidth - BUTTON_SIZE),
          bottom: Math.min(prev.bottom, window.innerHeight - BUTTON_SIZE),
        };
        if (clamped.right !== prev.right || clamped.bottom !== prev.bottom) {
          savePosition(clamped);
          return clamped;
        }
        return prev;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="group bg-slate-800 hover:bg-slate-700
        text-white rounded-full w-14 h-14 flex items-center justify-center
        shadow-lg shadow-black/30 hover:shadow-xl
        transition-shadow duration-200 hover:brightness-110 touch-none select-none"
      style={{
        position: 'fixed',
        bottom: `${position.bottom}px`,
        right: `${position.right}px`,
        zIndex: 950,
        cursor: 'grab',
      }}
      title="Open Ironclaw - Chief of Staff (drag to reposition)"
      aria-label="Open Ironclaw panel"
    >
      {/* Shield icon */}
      <svg
        className="w-7 h-7 text-amber-400 group-hover:text-amber-300 transition-colors pointer-events-none"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
        />
      </svg>

      {/* Unread notification dot */}
      {hasUnread && (
        <span
          className="absolute top-0 right-0 w-3 h-3 bg-red-500 rounded-full
            border-2 border-slate-800 animate-pulse pointer-events-none"
          aria-label="Unread messages"
        />
      )}
    </button>
  );
}
