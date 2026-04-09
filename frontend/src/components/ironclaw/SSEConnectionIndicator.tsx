/**
 * SSEConnectionIndicator -- SSE connection status dot indicator
 *
 * Shows Live/Reconnecting/Offline status for the SSE stream connection
 * per UI-SPEC Component #4.
 */

import type { SSEConnectionState } from '../../types/ironclaw.ts';

interface SSEConnectionIndicatorProps {
  state: SSEConnectionState;
}

export function SSEConnectionIndicator({ state }: SSEConnectionIndicatorProps) {
  return (
    <div className="flex items-center gap-1">
      {state === 'open' && (
        <>
          <span className="w-2 h-2 rounded-full bg-blue-400" />
          <span className="text-[10px] text-gray-500">Live</span>
        </>
      )}
      {state === 'connecting' && (
        <>
          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          <span className="text-[10px] text-gray-500">Reconnecting...</span>
        </>
      )}
      {state === 'closed' && (
        <>
          <span className="w-2 h-2 rounded-full bg-gray-600" />
          <span className="text-[10px] text-gray-500">Offline</span>
        </>
      )}
    </div>
  );
}
