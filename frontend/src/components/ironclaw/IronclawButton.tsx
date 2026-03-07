/**
 * IronclawButton -- Floating trigger button
 *
 * Fixed position bottom-right, z-index 950 (above AI staff 900, below modals 1000+).
 * Circular 56px button with notification dot for unread messages.
 */

interface IronclawButtonProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function IronclawButton({ onClick, hasUnread }: IronclawButtonProps) {
  return (
    <button
      onClick={onClick}
      className="group bg-slate-800 hover:bg-slate-700
        text-white rounded-full w-14 h-14 flex items-center justify-center
        shadow-lg shadow-black/30 hover:shadow-xl
        transition-all duration-200 hover:scale-105 hover:brightness-110"
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 950,
      }}
      title="Open Ironclaw - Chief of Staff"
      aria-label="Open Ironclaw panel"
    >
      {/* Shield icon */}
      <svg
        className="w-7 h-7 text-amber-400 group-hover:text-amber-300 transition-colors"
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
            border-2 border-slate-800 animate-pulse"
          aria-label="Unread messages"
        />
      )}
    </button>
  );
}
