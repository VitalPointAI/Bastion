/**
 * CostTrackingPanel
 *
 * Tracks all BASTION expenditures: LLM token costs and NEAR blockchain costs.
 * Shows total spend, breakdown by agent/model/type, and daily cost chart.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getCostSummary,
  getCostLedger,
  type CostSummary,
  type CostLedgerEntry,
} from '../../lib/admin-service';

function formatUsd(amount: number | string): string {
  const n = Number(amount) || 0;
  if (n < 0.01 && n > 0) return '<$0.01';
  return `$${n.toFixed(2)}`;
}

function formatTokens(count: number | string): string {
  const n = Number(count) || 0;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export function CostTrackingPanel() {
  const [summary, setSummary] = useState<CostSummary | null>(null);
  const [ledger, setLedger] = useState<CostLedgerEntry[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [ledgerPage, setLedgerPage] = useState(0);

  const getStartDate = useCallback(() => {
    if (dateRange === 'all') return undefined;
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString();
  }, [dateRange]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const startDate = getStartDate();
      const [summaryData, ledgerData] = await Promise.all([
        getCostSummary({ startDate }),
        getCostLedger({ startDate, limit: 20, offset: ledgerPage * 20 }),
      ]);
      setSummary(summaryData);
      setLedger(ledgerData.entries);
      setLedgerTotal(ledgerData.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cost data');
    } finally {
      setLoading(false);
    }
  }, [getStartDate, ledgerPage]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (loading && !summary) {
    return <div className="config-panel config-panel--loading"><p>Loading cost data...</p></div>;
  }

  if (error) {
    return (
      <div className="config-panel">
        <div className="alert alert--error"><span className="alert-icon">!</span>{error}</div>
      </div>
    );
  }

  if (!summary) return null;

  // Compute max cost for chart scaling
  const maxDayCost = Math.max(...summary.byDay.map((d) => d.costUsd), 0.01);

  return (
    <div className="config-panel" style={{ gap: '1.25rem', display: 'flex', flexDirection: 'column' }}>
      {/* Date range selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Cost Tracking</h3>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--surface-secondary, #1e293b)', borderRadius: 6, padding: 2 }}>
          {(['7d', '30d', '90d', 'all'] as const).map((range) => (
            <button
              key={range}
              onClick={() => { setDateRange(range); setLedgerPage(0); }}
              style={{
                padding: '4px 10px',
                fontSize: '0.75rem',
                border: 'none',
                borderRadius: 4,
                cursor: 'pointer',
                background: dateRange === range ? 'var(--accent-color, #3b82f6)' : 'transparent',
                color: dateRange === range ? '#fff' : 'var(--text-secondary, #94a3b8)',
              }}
            >
              {range === 'all' ? 'All' : range}
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <SummaryCard label="Total Spend" value={formatUsd(summary.totalCostUsd)} />
        <SummaryCard label="Input Tokens" value={formatTokens(summary.totalInputTokens)} />
        <SummaryCard label="Output Tokens" value={formatTokens(summary.totalOutputTokens)} />
        <SummaryCard label="Transactions" value={String(summary.totalEntries)} />
      </div>

      {/* Daily cost chart */}
      {summary.byDay.length > 0 && (
        <div style={{ background: 'var(--surface-secondary, #1e293b)', borderRadius: 8, padding: '16px', border: '1px solid var(--border-color, #334155)' }}>
          <h4 style={{ margin: '0 0 12px', fontSize: '0.85rem', fontWeight: 500 }}>Daily Cost</h4>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 120 }}>
            {[...summary.byDay].reverse().map((day) => {
              const heightPct = Math.max((day.costUsd / maxDayCost) * 100, 2);
              return (
                <div
                  key={day.date}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
                  title={`${formatDate(day.date)}: ${formatUsd(day.costUsd)} (${day.count} ops)`}
                >
                  <div
                    style={{
                      width: '100%',
                      maxWidth: 24,
                      height: `${heightPct}%`,
                      background: 'var(--accent-color, #3b82f6)',
                      borderRadius: '3px 3px 0 0',
                      minHeight: 2,
                      opacity: 0.8,
                    }}
                  />
                  <span style={{ fontSize: '0.55rem', color: 'var(--text-secondary, #64748b)', whiteSpace: 'nowrap' }}>
                    {formatDate(day.date).replace(/\s\d{4}/, '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Breakdown tables side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        {/* By Agent */}
        <div style={{ background: 'var(--surface-secondary, #1e293b)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-color, #334155)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 500 }}>By Agent</h4>
          {summary.byAgent.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>No data yet</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Agent</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Ops</th>
                </tr>
              </thead>
              <tbody>
                {summary.byAgent.map((row) => (
                  <tr key={row.agentId} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                    <td style={{ padding: '4px 0', color: 'var(--text-primary, #e2e8f0)' }}>{row.agentId}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatUsd(row.costUsd)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', color: 'var(--text-secondary, #94a3b8)' }}>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* By Model */}
        <div style={{ background: 'var(--surface-secondary, #1e293b)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-color, #334155)' }}>
          <h4 style={{ margin: '0 0 8px', fontSize: '0.85rem', fontWeight: 500 }}>By Model</h4>
          {summary.byModel.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>No data yet</p>
          ) : (
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Model</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Cost</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Tokens</th>
                </tr>
              </thead>
              <tbody>
                {summary.byModel.map((row) => (
                  <tr key={row.modelId} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                    <td style={{ padding: '4px 0', color: 'var(--text-primary, #e2e8f0)' }}>{row.modelId}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0' }}>{formatUsd(row.costUsd)}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', color: 'var(--text-secondary, #94a3b8)' }}>
                      {formatTokens(row.inputTokens + row.outputTokens)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* By Type summary */}
      {summary.byType.length > 0 && (
        <div style={{ display: 'flex', gap: '12px' }}>
          {summary.byType.map((t) => (
            <div
              key={t.costType}
              style={{
                flex: 1,
                background: 'var(--surface-secondary, #1e293b)',
                borderRadius: 8,
                padding: '10px 14px',
                border: '1px solid var(--border-color, #334155)',
              }}
            >
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {t.costType === 'llm' ? 'LLM API' : t.costType === 'near_gas' ? 'NEAR Gas' : 'NEAR Storage'}
              </div>
              <div style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary, #e2e8f0)', marginTop: 2 }}>
                {formatUsd(t.costUsd)}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #64748b)' }}>{t.count} transactions</div>
            </div>
          ))}
        </div>
      )}

      {/* Recent ledger entries */}
      <div style={{ background: 'var(--surface-secondary, #1e293b)', borderRadius: 8, padding: '12px', border: '1px solid var(--border-color, #334155)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <h4 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 500 }}>Recent Transactions</h4>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #64748b)' }}>
            {ledgerTotal} total
          </span>
        </div>
        {ledger.length === 0 ? (
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>No transactions recorded yet</p>
        ) : (
          <>
            <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ color: 'var(--text-secondary, #64748b)', borderBottom: '1px solid var(--border-color, #334155)' }}>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Time</th>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Type</th>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Agent</th>
                  <th style={{ textAlign: 'left', padding: '4px 0', fontWeight: 500 }}>Operation</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Tokens</th>
                  <th style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>Cost</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((entry) => (
                  <tr key={entry.id} style={{ borderBottom: '1px solid var(--border-color, #1e293b)' }}>
                    <td style={{ padding: '4px 0', color: 'var(--text-secondary, #94a3b8)' }}>{formatTimestamp(entry.created_at)}</td>
                    <td style={{ padding: '4px 0' }}>
                      <span style={{
                        fontSize: '0.65rem',
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: entry.cost_type === 'llm' ? 'rgba(59,130,246,0.15)' : 'rgba(234,179,8,0.15)',
                        color: entry.cost_type === 'llm' ? '#93c5fd' : '#fcd34d',
                      }}>
                        {entry.cost_type === 'llm' ? 'LLM' : 'NEAR'}
                      </span>
                    </td>
                    <td style={{ padding: '4px 0', color: 'var(--text-primary, #e2e8f0)' }}>{entry.agent_id ?? entry.actor_did?.slice(0, 16) ?? '—'}</td>
                    <td style={{ padding: '4px 0', color: 'var(--text-secondary, #94a3b8)' }}>{entry.operation ?? '—'}</td>
                    <td style={{ textAlign: 'right', padding: '4px 0', color: 'var(--text-secondary, #94a3b8)' }}>
                      {entry.input_tokens != null ? formatTokens(entry.input_tokens + (entry.output_tokens ?? 0)) : '—'}
                    </td>
                    <td style={{ textAlign: 'right', padding: '4px 0', fontWeight: 500 }}>{formatUsd(entry.cost_usd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Pagination */}
            {ledgerTotal > 20 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                <button
                  onClick={() => setLedgerPage((p) => Math.max(0, p - 1))}
                  disabled={ledgerPage === 0}
                  style={{ padding: '4px 12px', fontSize: '0.75rem', border: '1px solid var(--border-color, #334155)', borderRadius: 4, background: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}
                >
                  Prev
                </button>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', padding: '4px 0' }}>
                  Page {ledgerPage + 1} of {Math.ceil(ledgerTotal / 20)}
                </span>
                <button
                  onClick={() => setLedgerPage((p) => p + 1)}
                  disabled={(ledgerPage + 1) * 20 >= ledgerTotal}
                  style={{ padding: '4px 12px', fontSize: '0.75rem', border: '1px solid var(--border-color, #334155)', borderRadius: 4, background: 'none', color: 'var(--text-secondary, #94a3b8)', cursor: 'pointer' }}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      background: 'var(--surface-secondary, #1e293b)',
      borderRadius: 8,
      padding: '12px 16px',
      border: '1px solid var(--border-color, #334155)',
    }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary, #94a3b8)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary, #e2e8f0)', marginTop: 4 }}>{value}</div>
    </div>
  );
}
