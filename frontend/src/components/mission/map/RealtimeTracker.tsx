import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet-realtime';

/**
 * RealtimeTracker
 *
 * Phase 4.4 Plan 08: Real-time position tracking via WebSocket
 *
 * Note: WebSocket server not yet implemented. This component prepares
 * the client-side infrastructure for future real-time updates.
 */

interface RealtimeTrackerProps {
  websocketUrl?: string;
  onAssetUpdate?: (assetId: string, position: L.LatLng) => void;
  interval?: number; // Update check interval in milliseconds
}

interface AssetUpdate {
  id: string;
  type: 'unit' | 'sensor' | 'resource';
  position: {
    lat: number;
    lng: number;
  };
  heading?: number;
  speed?: number;
  timestamp: string;
}

export function RealtimeTracker({
  websocketUrl,
  onAssetUpdate,
  interval = 5000,
}: RealtimeTrackerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Only attempt connection if WebSocket URL is provided
    if (!websocketUrl) {
      console.info('[RealtimeTracker] No WebSocket URL provided, real-time tracking disabled');
      return;
    }

    let isActive = true;

    const connect = () => {
      if (!isActive) return;

      try {
        console.info('[RealtimeTracker] Connecting to WebSocket:', websocketUrl);
        const ws = new WebSocket(websocketUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          console.info('[RealtimeTracker] WebSocket connected');
          // Subscribe to position updates
          ws.send(JSON.stringify({
            type: 'subscribe',
            channel: 'position-updates',
          }));
        };

        ws.onmessage = (event) => {
          try {
            const update: AssetUpdate = JSON.parse(event.data);

            // Validate update structure
            if (!update.id || !update.position?.lat || !update.position?.lng) {
              console.warn('[RealtimeTracker] Invalid update received:', update);
              return;
            }

            const position = L.latLng(update.position.lat, update.position.lng);

            // Notify parent component
            onAssetUpdate?.(update.id, position);

            console.debug('[RealtimeTracker] Asset update:', update.id, position);
          } catch (error) {
            console.error('[RealtimeTracker] Error parsing update:', error);
          }
        };

        ws.onerror = (error) => {
          console.error('[RealtimeTracker] WebSocket error:', error);
        };

        ws.onclose = (event) => {
          console.info('[RealtimeTracker] WebSocket closed:', event.code, event.reason);
          wsRef.current = null;

          // Attempt reconnect if not a clean close
          if (isActive && event.code !== 1000) {
            console.info('[RealtimeTracker] Reconnecting in 5s...');
            reconnectTimeoutRef.current = window.setTimeout(() => {
              connect();
            }, 5000);
          }
        };
      } catch (error) {
        console.error('[RealtimeTracker] Failed to create WebSocket:', error);
      }
    };

    connect();

    return () => {
      isActive = false;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      if (wsRef.current) {
        wsRef.current.close(1000, 'Component unmounting');
        wsRef.current = null;
      }
    };
  }, [websocketUrl, onAssetUpdate, interval]);

  // This component doesn't render anything
  return null;
}

/**
 * Hook for using realtime tracking
 *
 * Usage:
 * ```tsx
 * const { subscribe, unsubscribe } = useRealtimeTracking('ws://localhost:3001/realtime');
 *
 * useEffect(() => {
 *   subscribe('UNIT-123', (position) => {
 *     console.log('Unit moved to:', position);
 *   });
 *   return () => unsubscribe('UNIT-123');
 * }, []);
 * ```
 */
export function useRealtimeTracking(websocketUrl?: string) {
  const subscribersRef = useRef<Map<string, (position: L.LatLng) => void>>(new Map());

  const handleUpdate = (assetId: string, position: L.LatLng) => {
    const handler = subscribersRef.current.get(assetId);
    if (handler) {
      handler(position);
    }
  };

  const subscribe = (assetId: string, handler: (position: L.LatLng) => void) => {
    subscribersRef.current.set(assetId, handler);
  };

  const unsubscribe = (assetId: string) => {
    subscribersRef.current.delete(assetId);
  };

  return {
    subscribe,
    unsubscribe,
    TrackerComponent: () => (
      <RealtimeTracker
        websocketUrl={websocketUrl}
        onAssetUpdate={handleUpdate}
      />
    ),
  };
}
