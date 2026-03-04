/**
 * NotificationBadge
 *
 * Reusable notification count badge.
 * - Renders a red circle with count
 * - Hidden when count is 0
 * - Shows "99+" when count exceeds maxDisplay
 * - Pulse animation on count change
 * - Designed for absolute positioning inside a relative container
 */

import { useEffect, useRef, useState } from 'react';

// ─── Props ────────────────────────────────────────────────────────────────────

interface NotificationBadgeProps {
  count: number;
  maxDisplay?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBadge({ count, maxDisplay = 99 }: NotificationBadgeProps) {
  const prevCountRef = useRef(count);
  const [isPulsing, setIsPulsing] = useState(false);

  // Trigger pulse animation when count changes
  useEffect(() => {
    if (count !== prevCountRef.current && count > 0) {
      setIsPulsing(true);
      const timer = setTimeout(() => setIsPulsing(false), 600);
      prevCountRef.current = count;
      return () => clearTimeout(timer);
    }
    prevCountRef.current = count;
  }, [count]);

  // Hidden when count is 0
  if (count <= 0) return null;

  const displayCount = count > maxDisplay ? `${maxDisplay}+` : String(count);

  return (
    <span
      className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 min-w-[1.25rem] flex items-center justify-center font-bold px-0.5"
      style={isPulsing ? { animation: 'badge-pulse 0.6s ease-out' } : undefined}
      aria-label={`${count} unread notification${count !== 1 ? 's' : ''}`}
      role="status"
    >
      {displayCount}
    </span>
  );
}
