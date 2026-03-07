/**
 * WiFi Scanner
 *
 * Phase 32 Plan 03: Combined mDNS + SSDP/UPnP scanner for WiFi device discovery.
 * Uses multicast-dns for mDNS queries and node-ssdp for SSDP M-SEARCH.
 * Emits standardized DiscoveryEvent objects for each discovered service/device.
 */

import * as os from 'node:os';
import { BaseScanner } from './scanner-interface.js';
import type { DiscoveryEvent, ScannerConfig } from '../types.js';

// Dynamic imports for graceful degradation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let makeMdns: ((opts?: any) => any) | null = null;
let SSDPClientClass: typeof import('node-ssdp').Client | null = null;

try {
  const mdnsModule = await import('multicast-dns');
  makeMdns = mdnsModule.default ?? mdnsModule;
} catch (err) {
  console.warn(
    '[WiFiScanner] multicast-dns not available — mDNS discovery disabled.',
    err instanceof Error ? err.message : err,
  );
}

try {
  const ssdpModule = await import('node-ssdp');
  SSDPClientClass = ssdpModule.Client;
} catch (err) {
  console.warn(
    '[WiFiScanner] node-ssdp not available — SSDP discovery disabled.',
    err instanceof Error ? err.message : err,
  );
}

export class WiFiScanner extends BaseScanner {
  readonly transportType = 'wifi' as const;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _mdns: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ssdp: any = null;
  private _queryTimer: ReturnType<typeof setInterval> | null = null;

  get isAvailable(): boolean {
    // WiFi scanning is available as long as at least one protocol module loaded
    return makeMdns !== null || SSDPClientClass !== null;
  }

  // -------------------------------------------------------------------------
  // Lifecycle hooks
  // -------------------------------------------------------------------------

  protected onStart(config: ScannerConfig): void {
    // Log available network interfaces for diagnostics
    const interfaces = os.networkInterfaces();
    const activeInterfaces = Object.entries(interfaces)
      .filter(([, addrs]) => addrs?.some((a: os.NetworkInterfaceInfo) => !a.internal))
      .map(([name]) => name);

    console.log('[WiFiScanner] Active network interfaces:', activeInterfaces.join(', '));

    if (config.interfaceFilter?.length) {
      console.log('[WiFiScanner] Interface filter:', config.interfaceFilter.join(', '));
    }

    // --- mDNS setup ---
    if (makeMdns) {
      try {
        this._mdns = makeMdns({
          interface: config.interfaceFilter?.[0], // bind to specific interface if configured
        });

        this._mdns.on('response', (response: { answers: Array<Record<string, unknown>> }) => {
          if (this._paused) return;
          this._handleMdnsResponse(response);
        });
      } catch (err) {
        console.warn('[WiFiScanner] Failed to create mDNS instance:', err);
      }
    }

    // --- SSDP setup ---
    if (SSDPClientClass) {
      try {
        this._ssdp = new SSDPClientClass({
          interfaces: config.interfaceFilter,
        });

        this._ssdp.on('response', (headers: Record<string, unknown>, _statusCode: number, rinfo: { address: string; port: number }) => {
          if (this._paused) return;
          this._handleSsdpResponse(headers, rinfo);
        });
      } catch (err) {
        console.warn('[WiFiScanner] Failed to create SSDP client:', err);
      }
    }

    // --- Periodic query timer ---
    this._queryTimer = setInterval(() => {
      if (this._paused) return;
      this._sendQueries();
    }, config.intervalMs);

    // Send initial queries immediately
    this._sendQueries();
  }

  protected onStop(): void {
    if (this._queryTimer) {
      clearInterval(this._queryTimer);
      this._queryTimer = null;
    }

    if (this._mdns) {
      try {
        this._mdns.destroy();
      } catch {
        // Ignore cleanup errors
      }
      this._mdns = null;
    }

    if (this._ssdp) {
      try {
        this._ssdp.stop();
      } catch {
        // Ignore cleanup errors
      }
      this._ssdp = null;
    }
  }

  protected onPause(): void {
    // Queries will be skipped while _paused is true; no active teardown needed
  }

  protected onResume(): void {
    // Next interval tick will send queries again
  }

  // -------------------------------------------------------------------------
  // mDNS response handling
  // -------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _handleMdnsResponse(response: { answers: Array<Record<string, any>> }): void {
    const now = Date.now();

    for (const answer of response.answers) {
      let rawIdentifier: string;
      const rawData: Record<string, unknown> = {
        protocol: 'mdns',
        recordType: answer.type,
        name: answer.name,
      };

      switch (answer.type) {
        case 'A':
        case 'AAAA':
          // Address record — data is the IP address
          rawIdentifier = `${answer.name}/${String(answer.data)}`;
          rawData.ip = answer.data;
          break;
        case 'PTR':
          // Pointer record — data is the target name
          rawIdentifier = `${answer.name}/${String(answer.data)}`;
          rawData.target = answer.data;
          break;
        case 'SRV':
          // Service record — data has target, port
          rawIdentifier = answer.name;
          rawData.service = answer.data;
          break;
        case 'TXT':
          // Text record
          rawIdentifier = answer.name;
          rawData.txt = answer.data;
          break;
        default:
          rawIdentifier = answer.name;
          rawData.data = answer.data;
          break;
      }

      const event: DiscoveryEvent = {
        transportType: 'wifi',
        rawIdentifier,
        firstSeen: now,
        lastSeen: now,
        rawData,
      };

      this.emit('discovered', event);
    }
  }

  // -------------------------------------------------------------------------
  // SSDP response handling
  // -------------------------------------------------------------------------

  private _handleSsdpResponse(
    headers: Record<string, unknown>,
    rinfo: { address: string; port: number },
  ): void {
    const now = Date.now();

    const event: DiscoveryEvent = {
      transportType: 'wifi',
      rawIdentifier: rinfo.address,
      firstSeen: now,
      lastSeen: now,
      rawData: {
        protocol: 'ssdp',
        address: rinfo.address,
        port: rinfo.port,
        location: headers['LOCATION'] ?? headers['location'],
        st: headers['ST'] ?? headers['st'],
        usn: headers['USN'] ?? headers['usn'],
        server: headers['SERVER'] ?? headers['server'],
        headers: { ...headers },
      },
    };

    this.emit('discovered', event);
  }

  // -------------------------------------------------------------------------
  // Query dispatch
  // -------------------------------------------------------------------------

  private _sendQueries(): void {
    // mDNS: browse for all services
    if (this._mdns) {
      try {
        this._mdns.query({
          questions: [
            { name: '_services._dns-sd._udp.local', type: 'PTR' },
          ],
        });
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }

    // SSDP: M-SEARCH for all devices
    if (this._ssdp) {
      try {
        this._ssdp.search('ssdp:all');
      } catch (err) {
        this.emit('error', err instanceof Error ? err : new Error(String(err)));
      }
    }
  }
}
