/**
 * BridgeTokenPanel Component
 *
 * Admin panel for generating device registration tokens and viewing
 * connected bridges. Tokens carry device properties (classification,
 * authority level, capabilities) that are applied to the resource DID
 * when the device registers.
 */

import { useState, useEffect, useCallback } from 'react';
import { adminService } from '../../lib/admin-service';

const DEVICE_TYPES = ['bridge', 'drone', 'ugv', 'sensor', 'relay'] as const;
const CLASSIFICATIONS = ['UNCLASSIFIED', 'SECRET', 'TOPSECRET', 'TS_SCI'] as const;
const AUTHORITY_LEVELS = [
  { value: 'observer', label: 'Observer', desc: 'Read-only telemetry' },
  { value: 'operator', label: 'Operator', desc: 'Execute assigned missions' },
  { value: 'autonomous', label: 'Autonomous', desc: 'Self-directed within policy' },
  { value: 'command', label: 'Command', desc: 'Full authority including resource allocation' },
] as const;

const CAPABILITY_PRESETS: Record<string, string[]> = {
  bridge: ['scanning', 'relay', 'queueing'],
  drone: ['flight', 'camera', 'telemetry', 'recon_area', 'overwatch', 'visual_search'],
  ugv: ['patrol', 'camera', 'telemetry', 'ISR'],
  sensor: ['telemetry', 'environmental'],
  relay: ['relay', 'mesh'],
};

interface GeneratedToken {
  token: string;
  expires_at: string;
  label?: string;
  device_type: string;
  classification: string;
  authority_level: string;
  capabilities: string[];
}

interface ConnectedBridge {
  bridge_id: string;
  did: string;
  capabilities: string[];
  last_heartbeat: number;
  connected_robots_count: number;
  connected_robots: string[];
}

export function BridgeTokenPanel() {
  // Form state
  const [label, setLabel] = useState('');
  const [deviceType, setDeviceType] = useState<string>('bridge');
  const [classification, setClassification] = useState<string>('UNCLASSIFIED');
  const [authorityLevel, setAuthorityLevel] = useState<string>('observer');
  const [capabilities, setCapabilities] = useState<string[]>([]);
  const [customCap, setCustomCap] = useState('');
  const [expiresMin, setExpiresMin] = useState(15);

  // Result state
  const [generatedToken, setGeneratedToken] = useState<GeneratedToken | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Connected bridges
  const [bridges, setBridges] = useState<ConnectedBridge[]>([]);
  const [bridgesLoading, setBridgesLoading] = useState(true);

  // Apply capability preset when device type changes
  useEffect(() => {
    setCapabilities(CAPABILITY_PRESETS[deviceType] ?? []);
  }, [deviceType]);

  // Load connected bridges
  const loadBridges = useCallback(async () => {
    try {
      setBridgesLoading(true);
      const result = await adminService.getBridgeStatus();
      setBridges(result.bridges);
    } catch {
      // Silently fail — bridges may not be set up yet
      setBridges([]);
    } finally {
      setBridgesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBridges();
    const interval = setInterval(loadBridges, 10_000);
    return () => clearInterval(interval);
  }, [loadBridges]);

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setCopied(false);
    try {
      const result = await adminService.generateBridgeToken({
        label: label || undefined,
        device_type: deviceType,
        classification,
        authority_level: authorityLevel,
        capabilities,
        expires_in_minutes: expiresMin,
      });
      setGeneratedToken(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate token');
    } finally {
      setGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!generatedToken) return;
    try {
      await navigator.clipboard.writeText(generatedToken.token);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch {
      // Fallback
      const el = document.createElement('textarea');
      el.value = generatedToken.token;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  };

  const handleAddCap = () => {
    const cap = customCap.trim().toLowerCase();
    if (cap && !capabilities.includes(cap)) {
      setCapabilities([...capabilities, cap]);
    }
    setCustomCap('');
  };

  const handleRemoveCap = (cap: string) => {
    setCapabilities(capabilities.filter((c) => c !== cap));
  };

  return (
    <div className="admin-panel" style={{ maxWidth: 720 }}>
      <h2>Device Registration</h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', margin: '0 0 1.5rem' }}>
        Generate one-time tokens for onboarding bridges, drones, and other equipment.
        Properties are embedded in the token and applied to the device DID at registration.
      </p>

      {/* Token Generation Form */}
      <div style={{ display: 'grid', gap: '1rem' }}>
        {/* Label */}
        <div>
          <label style={labelStyle}>Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="e.g. pyDrone Alpha, Bridge Bravo"
            style={inputStyle}
          />
        </div>

        {/* Device Type + Classification row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div>
            <label style={labelStyle}>Device Type</label>
            <select value={deviceType} onChange={(e) => setDeviceType(e.target.value)} style={inputStyle}>
              {DEVICE_TYPES.map((t) => (
                <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Classification</label>
            <select value={classification} onChange={(e) => setClassification(e.target.value)} style={inputStyle}>
              {CLASSIFICATIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Authority Level */}
        <div>
          <label style={labelStyle}>Authority Level</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem' }}>
            {AUTHORITY_LEVELS.map((al) => (
              <button
                key={al.value}
                onClick={() => setAuthorityLevel(al.value)}
                style={{
                  ...chipButtonStyle,
                  background: authorityLevel === al.value ? 'var(--accent, #3b82f6)' : 'var(--bg-tertiary, #1e293b)',
                  color: authorityLevel === al.value ? '#fff' : 'var(--text-secondary)',
                  border: authorityLevel === al.value ? '1px solid var(--accent)' : '1px solid var(--border, #334155)',
                }}
                title={al.desc}
              >
                {al.label}
              </button>
            ))}
          </div>
        </div>

        {/* Capabilities */}
        <div>
          <label style={labelStyle}>Capabilities</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '0.5rem' }}>
            {capabilities.map((cap) => (
              <span
                key={cap}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  padding: '0.2rem 0.6rem',
                  background: 'var(--bg-tertiary, #1e293b)',
                  border: '1px solid var(--border, #334155)',
                  borderRadius: '12px',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                }}
              >
                {cap}
                <button
                  onClick={() => handleRemoveCap(cap)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--text-tertiary, #64748b)',
                    cursor: 'pointer', padding: 0, fontSize: '0.9rem', lineHeight: 1,
                  }}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              value={customCap}
              onChange={(e) => setCustomCap(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCap())}
              placeholder="Add capability..."
              style={{ ...inputStyle, flex: 1 }}
            />
            <button onClick={handleAddCap} style={secondaryButtonStyle}>Add</button>
          </div>
        </div>

        {/* Expiry */}
        <div>
          <label style={labelStyle}>Token Expiry (minutes)</label>
          <input
            type="number"
            value={expiresMin}
            onChange={(e) => setExpiresMin(Math.max(1, parseInt(e.target.value) || 15))}
            min={1}
            max={1440}
            style={{ ...inputStyle, width: 120 }}
          />
        </div>

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={generating}
          style={{
            padding: '0.7rem 1.5rem',
            background: 'var(--accent, #3b82f6)',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: generating ? 'wait' : 'pointer',
            fontSize: '0.9rem',
            fontWeight: 600,
            opacity: generating ? 0.7 : 1,
          }}
        >
          {generating ? 'Generating...' : 'Generate Registration Token'}
        </button>

        {error && (
          <div style={{ padding: '0.75rem', background: '#7f1d1d33', border: '1px solid #991b1b', borderRadius: '6px', color: '#fca5a5', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
      </div>

      {/* Generated Token Display */}
      {generatedToken && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: 'var(--bg-tertiary, #0f172a)',
          border: '1px solid var(--accent, #3b82f6)',
          borderRadius: '8px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--accent)' }}>
              Registration Token
            </span>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
              Expires: {new Date(generatedToken.expires_at).toLocaleTimeString()}
            </span>
          </div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'var(--bg-primary, #020617)',
            padding: '0.6rem 0.8rem',
            borderRadius: '4px',
            fontFamily: 'monospace',
            fontSize: '0.85rem',
            color: 'var(--text-primary)',
            wordBreak: 'break-all',
          }}>
            <span style={{ flex: 1 }}>{generatedToken.token}</span>
            <button onClick={handleCopy} style={{ ...secondaryButtonStyle, whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {generatedToken.label && <Tag>{generatedToken.label}</Tag>}
            <Tag>{generatedToken.device_type}</Tag>
            <Tag>{generatedToken.classification}</Tag>
            <Tag>{generatedToken.authority_level}</Tag>
          </div>
        </div>
      )}

      {/* Connected Bridges */}
      <div style={{ marginTop: '2rem' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>
          Connected Bridges
          <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginLeft: '0.5rem' }}>
            ({bridges.length})
          </span>
        </h3>
        {bridgesLoading && bridges.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>Loading...</p>
        ) : bridges.length === 0 ? (
          <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
            No bridges connected. Generate a token above and use it with the bridge client.
          </p>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {bridges.map((b) => (
              <div key={b.bridge_id} style={{
                padding: '0.75rem',
                background: 'var(--bg-tertiary, #1e293b)',
                borderRadius: '6px',
                border: '1px solid var(--border, #334155)',
                fontSize: '0.85rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>{b.bridge_id}</span>
                  <span style={{ color: '#4ade80', fontSize: '0.78rem' }}>
                    {b.connected_robots_count} device{b.connected_robots_count !== 1 ? 's' : ''}
                  </span>
                </div>
                <div style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem', marginTop: '0.25rem' }}>
                  DID: {b.did.substring(0, 30)}...
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block',
      padding: '0.15rem 0.5rem',
      background: 'var(--bg-primary, #020617)',
      border: '1px solid var(--border, #334155)',
      borderRadius: '4px',
      fontSize: '0.72rem',
      color: 'var(--text-tertiary)',
    }}>
      {children}
    </span>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '0.3rem',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 0.75rem',
  background: 'var(--bg-tertiary, #1e293b)',
  border: '1px solid var(--border, #334155)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '0.85rem',
  boxSizing: 'border-box',
};

const secondaryButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.75rem',
  background: 'var(--bg-tertiary, #1e293b)',
  border: '1px solid var(--border, #334155)',
  borderRadius: '6px',
  color: 'var(--text-secondary)',
  cursor: 'pointer',
  fontSize: '0.8rem',
};

const chipButtonStyle: React.CSSProperties = {
  padding: '0.4rem 0.6rem',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '0.78rem',
  fontWeight: 500,
  textAlign: 'center',
};
