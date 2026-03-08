/**
 * useDiscovery -- WebSocket + state management hook for device discovery
 *
 * Phase 32 Plan 09: Real-time discovery state via WebSocket at /ws/discovery.
 * Follows useIronclaw pattern with exponential backoff reconnect.
 *
 * WebSocket event types:
 *   device_discovered   -> add to devices array
 *   device_state_changed -> update device in array
 *   device_lost          -> mark device disconnected
 *   scanner_status       -> update scanner status
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  DiscoveredDevice,
  DiscoveryStatus,
} from '../lib/discovery-service.ts';
import { discoveryService } from '../lib/discovery-service.ts';

// ---- Constants -------------------------------------------------------------

const WS_BASE_URL =
  typeof window !== 'undefined'
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/discovery`
    : 'ws://localhost:3001/ws/discovery';

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

// ---- Public interface ------------------------------------------------------

export interface UseDiscoveryResult {
  /** Currently known discovered devices */
  devices: DiscoveredDevice[];
  /** Current scanner status */
  scannerStatus: DiscoveryStatus | null;
  /** Whether WebSocket is connected */
  connected: boolean;
  /** Manually reload devices and status from REST API */
  refetch: () => Promise<void>;
}

// ---- Hook ------------------------------------------------------------------

export function useDiscovery(): UseDiscoveryResult {
  const [devices, setDevices] = useState<DiscoveredDevice[]>([]);
  const [scannerStatus, setScannerStatus] = useState<DiscoveryStatus | null>(null);
  const [connected, setConnected] = useState(false);

  // Refs for WebSocket lifecycle
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectDelayRef = useRef<number>(RECONNECT_BASE_MS);
  const mountedRef = useRef(true);

  // ---- REST fetch helper ---------------------------------------------------

  const refetch = useCallback(async () => {
    try {
      const [deviceList, status] = await Promise.all([
        discoveryService.listDevices(),
        discoveryService.getStatus(),
      ]);
      if (mountedRef.current) {
        setDevices(deviceList);
        setScannerStatus(status);
      }
    } catch (err) {
      console.error('[useDiscovery] refetch failed:', err);
    }
  }, []);

  // ---- WebSocket connection ------------------------------------------------

  const connectWebSocketRef = useRef<(() => void) | undefined>(undefined);

  const connectWebSocket = useCallback(() => {
    if (!mountedRef.current) return;

    const ws = new WebSocket(WS_BASE_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) {
        ws.close();
        return;
      }
      reconnectDelayRef.current = RECONNECT_BASE_MS;
      setConnected(true);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: Record<string, unknown>;
        };

        if (!msg.type || !msg.data) return;

        switch (msg.type) {
          case 'device_discovered': {
            const device = msg.data as unknown as DiscoveredDevice;
            setDevices((prev) => {
              // Avoid duplicates
              const exists = prev.some((d) => d.id === device.id);
              if (exists) {
                return prev.map((d) => (d.id === device.id ? device : d));
              }
              return [...prev, device];
            });
            break;
          }

          case 'device_state_changed': {
            const updated = msg.data as unknown as DiscoveredDevice;
            setDevices((prev) =>
              prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)),
            );
            break;
          }

          case 'device_lost': {
            const lostId = (msg.data.id ?? msg.data.deviceId) as string;
            if (lostId) {
              setDevices((prev) =>
                prev.map((d) =>
                  d.id === lostId ? { ...d, state: 'disconnected' as const } : d,
                ),
              );
            }
            break;
          }

          case 'scanner_status': {
            const status = msg.data as unknown as DiscoveryStatus;
            setScannerStatus(status);
            break;
          }

          case 'status_snapshot':
            // Initial connection acknowledgement -- no action needed
            break;

          default:
            break;
        }
      } catch {
        // Non-JSON or unexpected message -- ignore
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      // Attempt reconnect with exponential backoff
      const delay = reconnectDelayRef.current;
      reconnectDelayRef.current = Math.min(delay * 2, RECONNECT_MAX_MS);
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current) {
          connectWebSocketRef.current?.();
        }
      }, delay);
    };

    ws.onerror = (err) => {
      console.error('[useDiscovery] WebSocket error:', err);
      // onclose fires after onerror -- reconnect logic is in onclose
    };
  }, []);

  useEffect(() => {
    connectWebSocketRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // ---- Lifecycle: load initial data + connect WebSocket --------------------

  useEffect(() => {
    mountedRef.current = true;

    // Fetch initial data from REST API
    refetch();

    // Connect WebSocket for real-time updates
    connectWebSocket();

    return () => {
      mountedRef.current = false;

      // Cancel any pending reconnect
      if (reconnectTimerRef.current !== null) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }

      // Close WebSocket
      const ws = wsRef.current;
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [connectWebSocket, refetch]);

  return {
    devices,
    scannerStatus,
    connected,
    refetch,
  };
}
