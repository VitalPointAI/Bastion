/**
 * MemberDetailModal
 *
 * Displays detailed member profile information including DID document data
 * (entity type, public keys, service endpoints, credentials, security classification).
 * Fetches the DID document via the server-side member-profile endpoint.
 */

import { useState, useEffect } from 'react';
import type { ProblemSetMemberDetail } from '../../lib/problem-set-service';

// ─── API base ───────────────────────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_BACKEND_API_URL || '';

// ─── DID Document types (mirrors backend identity/types.ts) ─────────────────

interface PublicKeyEntry {
  id: string;
  type: string;
  controller: string;
  publicKeyBase58: string;
}

interface ServiceEndpoint {
  id: string;
  type: string;
  serviceEndpoint: string;
}

interface DIDDocument {
  '@context': string[];
  id: string;
  entityType: string;
  publicKey: PublicKeyEntry[];
  authentication: string[];
  controller: string[];
  service?: ServiceEndpoint[];
  created: string;
  updated: string;
}

interface MemberProfileResponse {
  accountId: string;
  did: string;
  found: boolean;
  didDocument: DIDDocument | null;
  message?: string;
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface MemberDetailModalProps {
  member: ProblemSetMemberDetail;
  onClose: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractAccountId(did: string): string {
  if (did.startsWith('did:near:')) {
    return did.replace('did:near:', '');
  }
  return did;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Entity type display with icon */
const ENTITY_ICONS: Record<string, string> = {
  Human: '\u{1F464}',
  AiAgent: '\u{1F916}',
  Vehicle: '\u{1F698}',
  Organization: '\u{1F3DB}',
  Mission: '\u{1F3AF}',
  DataObject: '\u{1F4C4}',
  Resource: '\u{1F4E6}',
};

function shortenKey(key: string): string {
  if (key.length <= 20) return key;
  return key.slice(0, 8) + '...' + key.slice(-8);
}

// ─── Component ───────────────────────────────────────────────────────────────

export function MemberDetailModal({ member, onClose }: MemberDetailModalProps) {
  const [profile, setProfile] = useState<MemberProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accountId = extractAccountId(member.userDid);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`${API_BASE}/api/identity/member-profile/${encodeURIComponent(accountId)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<MemberProfileResponse>;
      })
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load profile');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [accountId]);

  const doc = profile?.didDocument;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-white truncate">
            {member.displayName || accountId}
          </h2>
          <button
            className="text-gray-400 hover:text-white transition-colors text-xl leading-none ml-3"
            onClick={onClose}
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">

          {/* Membership Info */}
          <Section title="Membership">
            <InfoRow label="DID" value={member.userDid} mono />
            <InfoRow label="Role" value={member.role} />
            <InfoRow label="DAO Role" value={member.daoRole} />
            <InfoRow
              label="Status"
              value={
                <span className={member.status === 'active' ? 'text-green-400' : 'text-yellow-400'}>
                  {member.status}
                </span>
              }
            />
            <InfoRow label="Joined" value={formatDate(member.joinedAt)} />
          </Section>

          {/* DID Document */}
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              Resolving DID document...
            </div>
          ) : error ? (
            <div className="text-xs text-yellow-400/80 bg-yellow-900/20 border border-yellow-800/50 rounded px-3 py-2">
              DID document unavailable: {error}
            </div>
          ) : !profile?.found || !doc ? (
            <Section title="DID Document">
              <p className="text-sm text-gray-500">
                No DID document found on-chain for this account.
              </p>
            </Section>
          ) : (
            <>
              {/* Identity */}
              <Section title="Identity">
                <InfoRow
                  label="Entity Type"
                  value={
                    <span className="flex items-center gap-1.5">
                      <span>{ENTITY_ICONS[doc.entityType] ?? ''}</span>
                      {doc.entityType}
                    </span>
                  }
                />
                <InfoRow label="DID" value={doc.id} mono />
                {doc.controller.length > 0 && (
                  <InfoRow label="Controller" value={doc.controller.join(', ')} mono />
                )}
                <InfoRow label="Created" value={formatDate(doc.created)} />
                <InfoRow label="Updated" value={formatDate(doc.updated)} />
              </Section>

              {/* Public Keys / Credentials */}
              <Section title="Public Keys &amp; Credentials">
                {doc.publicKey.length === 0 ? (
                  <p className="text-sm text-gray-500">No public keys registered.</p>
                ) : (
                  <div className="space-y-2">
                    {doc.publicKey.map((pk) => (
                      <div
                        key={pk.id}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                      >
                        <div className="text-xs text-gray-400">{pk.type}</div>
                        <div className="text-xs text-blue-300 font-mono mt-0.5" title={pk.publicKeyBase58}>
                          {shortenKey(pk.publicKeyBase58)}
                        </div>
                        <div className="text-xs text-gray-600 mt-0.5">
                          Controller: {shortenKey(pk.controller)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Section>

              {/* Authentication */}
              {doc.authentication.length > 0 && (
                <Section title="Authentication">
                  <div className="space-y-1">
                    {doc.authentication.map((auth, i) => (
                      <div key={i} className="text-xs text-gray-300 font-mono bg-gray-800 border border-gray-700 rounded px-3 py-1.5">
                        {auth}
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Service Endpoints */}
              {doc.service && doc.service.length > 0 && (
                <Section title="Service Endpoints">
                  <div className="space-y-2">
                    {doc.service.map((svc) => (
                      <div
                        key={svc.id}
                        className="bg-gray-800 border border-gray-700 rounded px-3 py-2"
                      >
                        <div className="text-xs text-gray-400">{svc.type}</div>
                        <div className="text-xs text-blue-300 font-mono mt-0.5 break-all">
                          {svc.serviceEndpoint}
                        </div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Security Classification */}
              <Section title="Security Classification">
                <p className="text-xs text-gray-500">
                  Classification is derived from the entity type and problem set membership.
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/40 text-blue-400 border border-blue-800">
                    {doc.entityType === 'AiAgent' ? 'AI SYSTEM' : 'PERSONNEL'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-800 text-gray-400 border border-gray-700">
                    {member.status === 'active' ? 'CLEARED' : 'SUSPENDED'}
                  </span>
                </div>
              </Section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-xs text-gray-500 w-24 shrink-0 pt-0.5">{label}</span>
      <span
        className={`text-sm text-gray-200 break-all ${mono ? 'font-mono text-xs' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}
