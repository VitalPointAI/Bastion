/**
 * mDNS Network Scanner
 *
 * Discovers devices advertising services via multicast DNS (Bonjour/Avahi).
 * Browses for _bastion._tcp, _http._tcp, _ssh._tcp, and other common services.
 */

import { BaseScanner } from './scanner-interface.js';
import type { ScannerConfig, DiscoveryEvent, TransportType } from '../types.js';

const SERVICE_TYPES = [
  '_bastion._tcp',
  '_http._tcp',
  '_ssh._tcp',
  '_https._tcp',
];

export class MDNSScanner extends BaseScanner {
  readonly transportType: TransportType = 'mdns';
  private scanTimer: NodeJS.Timeout | null = null;
  private bonjour: unknown = null;

  get isAvailable(): boolean {
    return process.platform === 'linux' || process.platform === 'darwin';
  }

  protected onStart(config: ScannerConfig): void {
    if (!this.isAvailable) return;

    const intervalMs = config.intervalMs ?? 30_000;
    this.runScan();
    this.scanTimer = setInterval(() => this.runScan(), intervalMs);
  }

  protected onStop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    if (this.bonjour && typeof (this.bonjour as { destroy?: () => void }).destroy === 'function') {
      (this.bonjour as { destroy: () => void }).destroy();
      this.bonjour = null;
    }
  }

  protected onPause(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  protected onResume(): void {
    if (this._config) {
      const intervalMs = this._config.intervalMs ?? 30_000;
      this.runScan();
      this.scanTimer = setInterval(() => this.runScan(), intervalMs);
    }
  }

  private async runScan(): Promise<void> {
    if (this._paused) return;

    try {
      // Dynamic import to avoid issues if package not installed
      const { default: Bonjour } = await import('bonjour-service');
      const instance = new Bonjour();
      this.bonjour = instance;

      for (const serviceType of SERVICE_TYPES) {
        const [name, protocol] = serviceType.split('.');
        const browser = instance.find({ type: name.replace('_', ''), protocol: (protocol?.replace('_', '') ?? 'tcp') as 'tcp' | 'udp' });

        browser.on('up', (service: { name?: string; host?: string; port?: number; addresses?: string[]; txt?: Record<string, string> }) => {
          const ip = service.addresses?.[0] ?? service.host ?? 'unknown';
          const event: DiscoveryEvent = {
            transportType: 'mdns',
            rawIdentifier: `${ip}:${service.port ?? 0}`,
            signalStrength: undefined,
            firstSeen: Date.now(),
            lastSeen: Date.now(),
            rawData: {
              ip,
              port: service.port,
              hostname: service.host,
              name: service.name,
              service: serviceType,
              addresses: service.addresses,
              txt: service.txt,
            },
          };
          this.emit('discovered', event);
        });

        // Stop browsing after 10 seconds
        setTimeout(() => {
          try { browser.stop(); } catch { /* already stopped */ }
        }, 10_000);
      }

      // Clean up bonjour instance after scan window
      setTimeout(() => {
        try { instance.destroy(); } catch { /* ok */ }
        if (this.bonjour === instance) this.bonjour = null;
      }, 12_000);
    } catch (err) {
      console.warn('[MDNSScanner] Scan failed:', err instanceof Error ? err.message : err);
    }
  }
}
