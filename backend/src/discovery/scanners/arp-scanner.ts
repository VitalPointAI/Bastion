/**
 * ARP Network Scanner
 *
 * Discovers devices on the local network by reading the ARP table.
 * On Linux reads /proc/net/arp directly (no elevated permissions needed).
 * Falls back to `arp -a` on other platforms.
 */

import { readFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { BaseScanner } from './scanner-interface.js';
import type { ScannerConfig, DiscoveryEvent, TransportType } from '../types.js';

const execAsync = promisify(exec);

interface ARPEntry {
  ip: string;
  mac: string;
  device: string;
  flags: string;
}

export class ARPScanner extends BaseScanner {
  readonly transportType: TransportType = 'arp';
  private scanTimer: NodeJS.Timeout | null = null;
  private knownMacs = new Set<string>();

  get isAvailable(): boolean {
    return process.platform === 'linux' || process.platform === 'darwin';
  }

  protected onStart(config: ScannerConfig): void {
    if (!this.isAvailable) return;

    const intervalMs = config.intervalMs ?? 60_000;
    this.runScan();
    this.scanTimer = setInterval(() => this.runScan(), intervalMs);
  }

  protected onStop(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
    this.knownMacs.clear();
  }

  protected onPause(): void {
    if (this.scanTimer) {
      clearInterval(this.scanTimer);
      this.scanTimer = null;
    }
  }

  protected onResume(): void {
    if (this._config) {
      const intervalMs = this._config.intervalMs ?? 60_000;
      this.runScan();
      this.scanTimer = setInterval(() => this.runScan(), intervalMs);
    }
  }

  private async runScan(): Promise<void> {
    if (this._paused) return;

    try {
      const entries = process.platform === 'linux'
        ? await this.readProcArp()
        : await this.readArpCommand();

      for (const entry of entries) {
        // Skip incomplete entries and broadcast
        if (entry.mac === '00:00:00:00:00:00' || entry.flags === '0x0') continue;

        const event: DiscoveryEvent = {
          transportType: 'arp',
          rawIdentifier: entry.mac,
          signalStrength: undefined,
          firstSeen: Date.now(),
          lastSeen: Date.now(),
          rawData: {
            ip: entry.ip,
            mac: entry.mac,
            device: entry.device,
            isNew: !this.knownMacs.has(entry.mac),
          },
        };

        this.knownMacs.add(entry.mac);
        this.emit('discovered', event);
      }
    } catch (err) {
      console.warn('[ARPScanner] Scan failed:', err instanceof Error ? err.message : err);
    }
  }

  /** Read /proc/net/arp on Linux (no root required) */
  private async readProcArp(): Promise<ARPEntry[]> {
    const content = await readFile('/proc/net/arp', 'utf-8');
    const lines = content.trim().split('\n');
    // Skip header line
    return lines.slice(1).map(line => {
      const parts = line.trim().split(/\s+/);
      return {
        ip: parts[0] ?? '',
        flags: parts[2] ?? '',
        mac: parts[3] ?? '',
        device: parts[5] ?? '',
      };
    }).filter(e => e.ip && e.mac);
  }

  /** Fallback: parse `arp -a` output */
  private async readArpCommand(): Promise<ARPEntry[]> {
    const { stdout } = await execAsync('arp -a', { timeout: 5000 });
    const entries: ARPEntry[] = [];

    for (const line of stdout.split('\n')) {
      // Format: hostname (IP) at MAC [ether] on device
      const match = line.match(/\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)/i);
      if (match) {
        entries.push({
          ip: match[1],
          mac: match[2],
          device: '',
          flags: '0x2',
        });
      }
    }

    return entries;
  }
}
