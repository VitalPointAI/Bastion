/**
 * Device Fingerprinting Service
 *
 * Phase 32 Plan 04: Probes discovered devices to extract type, manufacturer,
 * capabilities, and protocol information across all 4 transport types.
 *
 * Designed for pg-boss job execution (async, never in scan callback).
 * Uses @noble/hashes for fingerprint hash generation.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { DiscoveryEvent, DeviceFingerprint, TransportType } from './types.js';

// ---------------------------------------------------------------------------
// BLE Company ID lookup (common vendors)
// ---------------------------------------------------------------------------

const BLE_COMPANY_IDS: Record<number, string> = {
  0x004c: 'Apple',
  0x0075: 'Samsung',
  0x0006: 'Microsoft',
  0x000f: 'Texas Instruments',
  0x0059: 'Nordic Semiconductor',
  0x00e0: 'Google',
  0x0310: 'Garmin',
  0x0087: 'Honeywell',
  0x0157: 'Raytheon',
  0x02e5: 'L3Harris',
};

// ---------------------------------------------------------------------------
// CoT type prefix mapping
// ---------------------------------------------------------------------------

const COT_TYPE_PREFIXES: Record<string, string> = {
  'a-f-G': 'Ground Friendly',
  'a-f-A': 'Air Friendly',
  'a-f-S': 'Sea Friendly',
  'a-f-U': 'Subsurface Friendly',
  'a-h-G': 'Ground Hostile',
  'a-h-A': 'Air Hostile',
  'a-n-G': 'Ground Neutral',
  'a-u-G': 'Ground Unknown',
  'b-m-p': 'Map Point',
  'b-r-f': 'Route',
};

// ---------------------------------------------------------------------------
// FingerprintService
// ---------------------------------------------------------------------------

export class FingerprintService {
  /**
   * Main entry point: fingerprint a discovered device based on transport type.
   * Async — may involve network calls (e.g., UPnP description fetch).
   */
  async fingerprint(event: DiscoveryEvent): Promise<DeviceFingerprint> {
    switch (event.transportType) {
      case 'ble':
        return this.fingerprintBLE(event);
      case 'wifi':
        return this.fingerprintWiFi(event);
      case 'usb':
        return this.fingerprintUSB(event);
      case 'tak':
        return this.fingerprintTAK(event);
      default:
        return { capabilities: [] };
    }
  }

  /**
   * Generate a deterministic SHA-256 hash of a canonical fingerprint.
   * Used for access list matching via fingerprint_hash match type.
   */
  static generateFingerprintHash(fingerprint: DeviceFingerprint): string {
    // Canonical form: sorted keys, no undefined values
    const canonical = {
      capabilities: [...fingerprint.capabilities].sort(),
      firmwareVersion: fingerprint.firmwareVersion ?? null,
      hardwareId: fingerprint.hardwareId ?? null,
      manufacturer: fingerprint.manufacturer ?? null,
      model: fingerprint.model ?? null,
      protocolVersions: fingerprint.protocolVersions
        ? [...fingerprint.protocolVersions].sort()
        : null,
    };
    const bytes = utf8ToBytes(JSON.stringify(canonical));
    return bytesToHex(sha256(bytes));
  }

  // -------------------------------------------------------------------------
  // BLE fingerprinting
  // -------------------------------------------------------------------------

  private fingerprintBLE(event: DiscoveryEvent): DeviceFingerprint {
    const raw = event.rawData;
    const fingerprint: DeviceFingerprint = { capabilities: [] };

    // Extract manufacturer from manufacturerData company ID
    const mfgData = raw.manufacturerData as Uint8Array | undefined;
    if (mfgData && mfgData.length >= 2) {
      const companyId = (mfgData[1] << 8) | mfgData[0]; // little-endian
      fingerprint.manufacturer = BLE_COMPANY_IDS[companyId] ?? `BLE:0x${companyId.toString(16).padStart(4, '0')}`;
    }

    // localName as displayName
    if (typeof raw.localName === 'string' && raw.localName) {
      fingerprint.displayName = raw.localName;
    }

    // serviceUuids as capabilities
    const serviceUuids = raw.serviceUuids as string[] | undefined;
    if (Array.isArray(serviceUuids)) {
      fingerprint.capabilities = serviceUuids.map((uuid) => `ble:${uuid}`);
    }

    // Hardware ID from MAC if available
    if (event.rawIdentifier) {
      fingerprint.hardwareId = event.rawIdentifier;
    }

    return fingerprint;
  }

  // -------------------------------------------------------------------------
  // WiFi fingerprinting (mDNS/SSDP/UPnP)
  // -------------------------------------------------------------------------

  private async fingerprintWiFi(event: DiscoveryEvent): Promise<DeviceFingerprint> {
    const raw = event.rawData;
    const fingerprint: DeviceFingerprint = { capabilities: [] };

    // mDNS: parse service type from PTR name
    const ptrName = raw.ptrName as string | undefined;
    if (ptrName) {
      const serviceMatch = ptrName.match(/_([^.]+)\._([^.]+)/);
      if (serviceMatch) {
        fingerprint.capabilities.push(serviceMatch[1]);
      }
      fingerprint.displayName = ptrName.split('.')[0];
    }

    // mDNS TXT records
    const txtRecords = raw.txtRecords as Record<string, string> | undefined;
    if (txtRecords) {
      if (txtRecords.model) fingerprint.model = txtRecords.model;
      if (txtRecords.manufacturer) fingerprint.manufacturer = txtRecords.manufacturer;
      if (txtRecords.fw) fingerprint.firmwareVersion = txtRecords.fw;
    }

    // SSDP: UPnP device description from LOCATION header
    const ssdpLocation = raw.location as string | undefined;
    if (ssdpLocation) {
      try {
        const upnp = await this.fetchUpnpDescription(ssdpLocation);
        if (upnp.friendlyName) fingerprint.displayName = upnp.friendlyName;
        if (upnp.manufacturer) fingerprint.manufacturer = upnp.manufacturer;
        if (upnp.modelName) fingerprint.model = upnp.modelName;
        if (upnp.modelNumber) fingerprint.firmwareVersion = upnp.modelNumber;
      } catch {
        // UPnP fetch failed — continue with what we have
      }
    }

    // Server header gives protocol info
    const server = raw.server as string | undefined;
    if (server) {
      fingerprint.protocolVersions = [server];
    }

    if (event.rawIdentifier) {
      fingerprint.hardwareId = event.rawIdentifier;
    }

    return fingerprint;
  }

  /**
   * Fetch and parse a UPnP device description XML.
   * Extracts friendlyName, manufacturer, modelName, modelNumber.
   */
  private async fetchUpnpDescription(
    locationUrl: string,
  ): Promise<{
    friendlyName?: string;
    manufacturer?: string;
    modelName?: string;
    modelNumber?: string;
  }> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    try {
      const response = await fetch(locationUrl, {
        signal: controller.signal,
      });
      const xml = await response.text();

      // Simple XML extraction (no full parser needed for device description)
      const extract = (tag: string): string | undefined => {
        const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`));
        return match?.[1] || undefined;
      };

      return {
        friendlyName: extract('friendlyName'),
        manufacturer: extract('manufacturer'),
        modelName: extract('modelName'),
        modelNumber: extract('modelNumber'),
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  // -------------------------------------------------------------------------
  // USB fingerprinting
  // -------------------------------------------------------------------------

  private fingerprintUSB(event: DiscoveryEvent): DeviceFingerprint {
    const raw = event.rawData;
    const fingerprint: DeviceFingerprint = { capabilities: [] };

    // vendorId / productId from serialport enumeration
    const vendorId = raw.vendorId as string | undefined;
    const productId = raw.productId as string | undefined;

    if (vendorId) {
      fingerprint.manufacturer = `USB:${vendorId}`;
    }
    if (typeof raw.manufacturer === 'string') {
      fingerprint.manufacturer = raw.manufacturer;
    }
    if (productId) {
      fingerprint.model = `USB:${productId}`;
    }

    // serialNumber as hardwareId
    const serialNumber = raw.serialNumber as string | undefined;
    if (serialNumber) {
      fingerprint.hardwareId = serialNumber;
    }

    // Display name from manufacturer string or path
    if (typeof raw.manufacturer === 'string') {
      fingerprint.displayName = raw.manufacturer;
    }

    // Capabilities from device class
    const deviceClass = raw.deviceClass as string | undefined;
    if (deviceClass) {
      fingerprint.capabilities.push(`usb:class:${deviceClass}`);
    }

    return fingerprint;
  }

  // -------------------------------------------------------------------------
  // TAK/CoT fingerprinting
  // -------------------------------------------------------------------------

  private fingerprintTAK(event: DiscoveryEvent): DeviceFingerprint {
    const raw = event.rawData;
    const fingerprint: DeviceFingerprint = { capabilities: ['tak', 'cot'] };

    // CoT event type attribute (e.g., a-f-G for ground friendly)
    const cotType = raw.type as string | undefined;
    if (cotType) {
      const displayType = this.resolveCotType(cotType);
      fingerprint.model = displayType;
      fingerprint.capabilities.push(`cot:${cotType}`);
    }

    // Callsign from detail
    const callsign = raw.callsign as string | undefined;
    if (callsign) {
      fingerprint.displayName = callsign;
    }

    // TAK platform info
    const platform = raw.platform as string | undefined;
    if (platform) {
      fingerprint.manufacturer = platform;
    }

    const version = raw.version as string | undefined;
    if (version) {
      fingerprint.firmwareVersion = version;
    }

    // UID as hardware ID
    const uid = raw.uid as string | undefined;
    if (uid) {
      fingerprint.hardwareId = uid;
    }

    return fingerprint;
  }

  /**
   * Resolve CoT type string to human-readable description.
   */
  private resolveCotType(cotType: string): string {
    // Check exact match first, then progressively shorter prefixes
    for (let len = cotType.length; len >= 3; len -= 2) {
      const prefix = cotType.substring(0, len);
      if (COT_TYPE_PREFIXES[prefix]) {
        return COT_TYPE_PREFIXES[prefix];
      }
    }
    return cotType;
  }
}
