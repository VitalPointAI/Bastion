/**
 * TAK CoT Scanner
 *
 * Phase 32 Plan 03: Listens for Cursor-on-Target (CoT) Situational Awareness
 * messages on standard TAK ports. Uses @tak-ps/node-cot to parse CoT XML.
 * Emits standardized DiscoveryEvent objects for each CoT event received.
 *
 * Standard TAK SA ports:
 *   - TCP 8087 (TAK Server streaming)
 *   - UDP 6969 (Multicast SA broadcast)
 */

import * as net from 'node:net';
import * as dgram from 'node:dgram';
import { BaseScanner } from './scanner-interface.js';
import type { DiscoveryEvent, ScannerConfig } from '../types.js';

// Dynamic import for graceful degradation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let CoTClass: (new (cot: string | Buffer) => any) | null = null;

try {
  const cotModule = await import('@tak-ps/node-cot');
  CoTClass = cotModule.default;
} catch (err) {
  console.warn(
    '[TAKScanner] @tak-ps/node-cot not available — TAK scanning disabled.',
    err instanceof Error ? err.message : err,
  );
}

const TAK_TCP_PORT = 8087;
const TAK_UDP_PORT = 6969;

export class TAKScanner extends BaseScanner {
  readonly transportType = 'tak' as const;

  private _tcpServer: net.Server | null = null;
  private _udpSocket: dgram.Socket | null = null;
  private _available = true;

  get isAvailable(): boolean {
    // TAK scanner is listener-based — always available unless ports are in use
    return this._available && CoTClass !== null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  protected onStart(_config: ScannerConfig): void {
    if (!CoTClass) {
      console.warn('[TAKScanner] node-cot not available, skipping start');
      this._available = false;
      return;
    }

    this._startTcpServer();
    this._startUdpSocket();
  }

  protected onStop(): void {
    if (this._tcpServer) {
      try {
        this._tcpServer.close();
      } catch {
        // Ignore
      }
      this._tcpServer = null;
    }

    if (this._udpSocket) {
      try {
        this._udpSocket.close();
      } catch {
        // Ignore
      }
      this._udpSocket = null;
    }
  }

  protected onPause(): void {
    // Messages will still arrive but we ignore them while paused (checked in handlers)
  }

  protected onResume(): void {
    // Handlers resume processing on next message
  }

  // -------------------------------------------------------------------------
  // TCP Server (TAK Server streaming port 8087)
  // -------------------------------------------------------------------------

  private _startTcpServer(): void {
    this._tcpServer = net.createServer((socket) => {
      let buffer = '';

      socket.on('data', (data) => {
        if (this._paused) return;

        buffer += data.toString('utf-8');

        // CoT messages are XML events — look for complete <event>...</event>
        let startIdx: number;
        let endIdx: number;

        // eslint-disable-next-line no-constant-condition
        while (true) {
          startIdx = buffer.indexOf('<event');
          endIdx = buffer.indexOf('</event>');

          if (startIdx === -1 || endIdx === -1) break;

          const xmlEnd = endIdx + '</event>'.length;
          const xmlMessage = buffer.substring(startIdx, xmlEnd);
          buffer = buffer.substring(xmlEnd);

          this._parseCotMessage(xmlMessage);
        }
      });

      socket.on('error', (err) => {
        // Individual connection errors are not fatal
        console.warn('[TAKScanner] TCP connection error:', err.message);
      });
    });

    this._tcpServer.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[TAKScanner] TCP port ${TAK_TCP_PORT} in use — TCP listener disabled`);
        this._tcpServer = null;
        this._checkStillAvailable();
      } else {
        this.emit('error', err);
      }
    });

    this._tcpServer.listen(TAK_TCP_PORT, () => {
      console.log(`[TAKScanner] TCP server listening on port ${TAK_TCP_PORT}`);
    });
  }

  // -------------------------------------------------------------------------
  // UDP Socket (TAK SA multicast port 6969)
  // -------------------------------------------------------------------------

  private _startUdpSocket(): void {
    this._udpSocket = dgram.createSocket({ type: 'udp4', reuseAddr: true });

    this._udpSocket.on('message', (msg) => {
      if (this._paused) return;

      const xmlMessage = msg.toString('utf-8');
      this._parseCotMessage(xmlMessage);
    });

    this._udpSocket.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.warn(`[TAKScanner] UDP port ${TAK_UDP_PORT} in use — UDP listener disabled`);
        this._udpSocket = null;
        this._checkStillAvailable();
      } else {
        this.emit('error', err);
      }
    });

    this._udpSocket.bind(TAK_UDP_PORT, () => {
      console.log(`[TAKScanner] UDP socket listening on port ${TAK_UDP_PORT}`);
    });
  }

  // -------------------------------------------------------------------------
  // CoT message parsing
  // -------------------------------------------------------------------------

  private _parseCotMessage(xml: string): void {
    if (!CoTClass) return;

    try {
      const cot = new CoTClass(xml);
      const attrs = cot.raw.event._attributes;
      const point = cot.raw.event.point;
      const detail = cot.raw.event.detail;

      const now = Date.now();
      const event: DiscoveryEvent = {
        transportType: 'tak',
        rawIdentifier: attrs.uid,
        firstSeen: now,
        lastSeen: now,
        rawData: {
          uid: attrs.uid,
          cotType: attrs.type,
          how: attrs.how,
          time: attrs.time,
          start: attrs.start,
          stale: attrs.stale,
          lat: point?._attributes?.lat ? parseFloat(point._attributes.lat) : undefined,
          lon: point?._attributes?.lon ? parseFloat(point._attributes.lon) : undefined,
          hae: point?._attributes?.hae ? parseFloat(point._attributes.hae) : undefined,
          ce: point?._attributes?.ce ? parseFloat(point._attributes.ce) : undefined,
          le: point?._attributes?.le ? parseFloat(point._attributes.le) : undefined,
          detail: detail ?? undefined,
        },
      };

      this.emit('discovered', event);
    } catch (err) {
      // Invalid CoT messages are common on noisy networks — log but do not emit error
      console.warn(
        '[TAKScanner] Failed to parse CoT message:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  // -------------------------------------------------------------------------
  // Availability check after port failures
  // -------------------------------------------------------------------------

  private _checkStillAvailable(): void {
    if (!this._tcpServer && !this._udpSocket) {
      this._available = false;
      console.warn('[TAKScanner] Both TCP and UDP ports unavailable — TAK scanning disabled');
    }
  }
}
