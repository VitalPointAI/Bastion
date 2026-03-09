/**
 * IntelligenceReport - Unified intelligence report display
 *
 * Expandable card format showing all specialist findings from the
 * document intelligence pipeline: facts, perspectives, bias assessment,
 * cross-document links, quality rating, and classification.
 */

import { useState, useCallback } from 'react';
import { NATORatingPanel } from './NATORatingPanel';
import type { NATORating } from './NATORatingPanel';

// ============================================================================
// Types (frontend mirrors of backend doc-intelligence/types.ts)
// ============================================================================

export type FactType = 'entity' | 'date' | 'location' | 'quantity' | 'assertion' | 'capability';
export type PerspectiveCategory = 'friendly' | 'adversary' | 'neutral' | 'partner';
export type BiasSeverity = 'low' | 'medium' | 'high' | 'critical';
export type LinkType = 'corroborates' | 'contradicts' | 'extends' | 'references';

export type DocumentType =
  | 'INTEL_ESTIMATE'
  | 'CONOP'
  | 'POLICY_PAPER'
  | 'NEWS_ARTICLE'
  | 'ACADEMIC_RESEARCH'
  | 'MILITARY_ORDER'
  | 'DIPLOMATIC_CABLE'
  | 'OSINT_REPORT'
  | 'OTHER';

export interface ExtractedFact {
  claim: string;
  type: FactType;
  confidence: number;
  sourceReference: {
    page?: number;
    paragraph?: number;
    quote: string;
  };
  entities: string[];
  temporalContext?: string;
  geospatialContext?: string;
}

export interface PerspectiveAnalysis {
  perspective: PerspectiveCategory;
  implications: string[];
  opportunities: string[];
  threats: string[];
  unknowns: string[];
}

export interface BiasAssessment {
  biasType: string;
  severity: BiasSeverity;
  evidence: string;
  recommendation: string;
}

export interface CrossDocLink {
  sourceDocId: string;
  targetDocId: string;
  linkType: LinkType;
  strength: number;
  evidence: string;
}

export interface TriageDecision {
  documentType: DocumentType;
  relevanceScore: number;
  specialists: string[];
  reasoning: string;
}

export interface DocumentIntelligenceReport {
  documentId: string;
  problemSetId: string;
  triage: TriageDecision;
  facts: ExtractedFact[];
  perspectives: PerspectiveAnalysis[];
  biasFindings: BiasAssessment[];
  qualityRating: NATORating;
  crossDocLinks: CrossDocLink[];
  summary: string;
}

// ============================================================================
// Utility helpers
// ============================================================================

const FACT_TYPE_ICONS: Record<FactType, string> = {
  entity: '\uD83C\uDFE2',
  date: '\uD83D\uDCC5',
  location: '\uD83D\uDCCD',
  quantity: '#',
  assertion: '\uD83D\uDCAC',
  capability: '\u2699',
};

const PERSPECTIVE_COLORS: Record<PerspectiveCategory, { bg: string; text: string; border: string }> = {
  friendly: { bg: 'bg-blue-900/30', text: 'text-blue-400', border: 'border-blue-700' },
  adversary: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700' },
  neutral: { bg: 'bg-gray-800/30', text: 'text-gray-400', border: 'border-gray-700' },
  partner: { bg: 'bg-green-900/30', text: 'text-green-400', border: 'border-green-700' },
};

const SEVERITY_COLORS: Record<BiasSeverity, { bg: string; text: string; border: string }> = {
  low: { bg: 'bg-gray-800/30', text: 'text-gray-400', border: 'border-gray-600' },
  medium: { bg: 'bg-yellow-900/30', text: 'text-yellow-400', border: 'border-yellow-700' },
  high: { bg: 'bg-orange-900/30', text: 'text-orange-400', border: 'border-orange-700' },
  critical: { bg: 'bg-red-900/30', text: 'text-red-400', border: 'border-red-700' },
};

const LINK_TYPE_LABELS: Record<LinkType, { label: string; color: string }> = {
  corroborates: { label: 'Corroborates', color: 'text-green-400' },
  contradicts: { label: 'Contradicts', color: 'text-red-400' },
  extends: { label: 'Extends', color: 'text-blue-400' },
  references: { label: 'References', color: 'text-gray-400' },
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  INTEL_ESTIMATE: 'Intel Estimate',
  CONOP: 'CONOP',
  POLICY_PAPER: 'Policy Paper',
  NEWS_ARTICLE: 'News Article',
  ACADEMIC_RESEARCH: 'Academic Research',
  MILITARY_ORDER: 'Military Order',
  DIPLOMATIC_CABLE: 'Diplomatic Cable',
  OSINT_REPORT: 'OSINT Report',
  OTHER: 'Other',
};

// ============================================================================
// Expandable Section Component
// ============================================================================

interface SectionProps {
  title: string;
  count: number;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

function ExpandableSection({ title, count, defaultExpanded = false, children }: SectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-t border-gray-800">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-300 font-medium">{title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-400 font-mono">
            {count}
          </span>
        </div>
        <span className="text-gray-600 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
      </button>
      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}

// ============================================================================
// Confidence Bar Component
// ============================================================================

function ConfidenceBar({ value }: { value: number }) {
  const percent = Math.round(value * 100);
  const color =
    percent >= 80 ? 'bg-green-500' : percent >= 60 ? 'bg-yellow-500' : percent >= 40 ? 'bg-orange-500' : 'bg-red-500';

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${percent}%` }} />
      </div>
      <span className="text-[10px] text-gray-500 font-mono w-8 text-right">{percent}%</span>
    </div>
  );
}

// ============================================================================
// IntelligenceReport Component
// ============================================================================

interface IntelligenceReportProps {
  report: DocumentIntelligenceReport;
  onRatingOverride: (newRating: Partial<NATORating>, reason: string) => void;
}

export function IntelligenceReport({ report, onRatingOverride }: IntelligenceReportProps) {
  const [expanded, setExpanded] = useState(true);

  const handleRatingOverride = useCallback(
    (newRating: Partial<NATORating>, reason: string) => {
      onRatingOverride(newRating, reason);
    },
    [onRatingOverride]
  );

  const relevancePercent = Math.round(report.triage.relevanceScore * 100);

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Report Header (always visible) */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-800/20 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-200 truncate max-w-[300px]">
              {report.documentId}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-800/50 text-purple-300 border border-purple-700/50">
              {DOC_TYPE_LABELS[report.triage.documentType] || report.triage.documentType}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Relevance score */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-gray-500">Relevance</span>
            <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  relevancePercent >= 70 ? 'bg-green-500' : relevancePercent >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${relevancePercent}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-400 font-mono">{relevancePercent}%</span>
          </div>
          {/* NATO rating badge */}
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 font-mono">
            {report.qualityRating.sourceReliability}{report.qualityRating.informationCredibility}
          </span>
          <span className="text-gray-600 text-xs">{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </button>

      {expanded && (
        <>
          {/* Summary (always visible when expanded) */}
          <div className="px-4 pb-3">
            <p className="text-sm text-gray-300 leading-relaxed">{report.summary}</p>
          </div>

          {/* Facts Section */}
          <ExpandableSection title="Facts" count={report.facts.length}>
            <div className="space-y-2">
              {report.facts.map((fact, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800/30 border border-gray-700/50 rounded p-3"
                >
                  <div className="flex items-start gap-2 mb-1">
                    <span className="text-sm shrink-0">
                      {FACT_TYPE_ICONS[fact.type] || '\u2022'}
                    </span>
                    <div className="flex-1">
                      <p className="text-xs text-gray-200">{fact.claim}</p>
                      <div className="mt-1.5">
                        <ConfidenceBar value={fact.confidence} />
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-500 capitalize shrink-0">{fact.type}</span>
                  </div>
                  {fact.sourceReference.quote && (
                    <p className="text-[10px] text-gray-500 mt-2 italic border-l-2 border-gray-700 pl-2">
                      "{fact.sourceReference.quote}"
                    </p>
                  )}
                  {fact.entities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {fact.entities.map((entity, eIdx) => (
                        <span
                          key={eIdx}
                          className="text-[10px] px-1 py-0.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-800/50"
                        >
                          {entity}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </ExpandableSection>

          {/* Perspectives Section */}
          <ExpandableSection title="Perspectives" count={report.perspectives.length}>
            <div className="space-y-3">
              {report.perspectives.map((perspective, idx) => {
                const colors = PERSPECTIVE_COLORS[perspective.perspective];
                return (
                  <div
                    key={idx}
                    className={`${colors.bg} border ${colors.border} rounded-lg p-3`}
                  >
                    <h4 className={`text-xs font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
                      {perspective.perspective}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {perspective.implications.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Implications</p>
                          <ul className="space-y-0.5">
                            {perspective.implications.map((item, iIdx) => (
                              <li key={iIdx} className="text-xs text-gray-300">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {perspective.opportunities.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Opportunities</p>
                          <ul className="space-y-0.5">
                            {perspective.opportunities.map((item, iIdx) => (
                              <li key={iIdx} className="text-xs text-green-400/80">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {perspective.threats.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Threats</p>
                          <ul className="space-y-0.5">
                            {perspective.threats.map((item, iIdx) => (
                              <li key={iIdx} className="text-xs text-red-400/80">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {perspective.unknowns.length > 0 && (
                        <div>
                          <p className="text-[10px] text-gray-500 mb-1">Unknowns</p>
                          <ul className="space-y-0.5">
                            {perspective.unknowns.map((item, iIdx) => (
                              <li key={iIdx} className="text-xs text-yellow-400/80">- {item}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ExpandableSection>

          {/* Bias Assessment Section */}
          <ExpandableSection title="Bias Assessment" count={report.biasFindings.length}>
            <div className="space-y-2">
              {report.biasFindings.map((bias, idx) => {
                const colors = SEVERITY_COLORS[bias.severity];
                return (
                  <div
                    key={idx}
                    className={`${colors.bg} border ${colors.border} rounded p-3`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className={`text-xs font-medium ${colors.text}`}>
                        {bias.biasType}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${colors.bg} ${colors.text} border ${colors.border} uppercase`}>
                        {bias.severity}
                      </span>
                    </div>
                    <p className="text-xs text-gray-300 mb-1">{bias.evidence}</p>
                    <p className="text-[10px] text-gray-500 italic">{bias.recommendation}</p>
                  </div>
                );
              })}
            </div>
          </ExpandableSection>

          {/* Cross-Document Links Section */}
          <ExpandableSection title="Cross-Document Links" count={report.crossDocLinks.length}>
            <div className="space-y-2">
              {report.crossDocLinks.map((link, idx) => {
                const linkStyle = LINK_TYPE_LABELS[link.linkType];
                return (
                  <div
                    key={idx}
                    className="bg-gray-800/30 border border-gray-700/50 rounded p-3 flex items-start gap-3"
                  >
                    <div className="shrink-0 text-center">
                      <span className={`text-xs font-medium ${linkStyle.color}`}>
                        {linkStyle.label}
                      </span>
                      <div className="mt-1">
                        <ConfidenceBar value={link.strength} />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-200 font-mono truncate">
                        {link.targetDocId}
                      </p>
                      <p className="text-[10px] text-gray-400 mt-1">{link.evidence}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </ExpandableSection>

          {/* Quality Assessment (NATO Rating Panel) */}
          <ExpandableSection title="Quality Assessment" count={1}>
            <NATORatingPanel
              rating={report.qualityRating}
              documentId={report.documentId}
              onOverride={handleRatingOverride}
            />
          </ExpandableSection>

          {/* Classification Section */}
          <ExpandableSection title="Classification" count={1}>
            <div className="bg-gray-800/30 border border-gray-700/50 rounded p-3 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Document Type:</span>
                <span className="text-xs text-gray-300">
                  {DOC_TYPE_LABELS[report.triage.documentType] || report.triage.documentType}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-500">Relevance Score:</span>
                <div className="flex-1 max-w-[200px]">
                  <ConfidenceBar value={report.triage.relevanceScore} />
                </div>
              </div>
              <div>
                <span className="text-[10px] text-gray-500">Triage Reasoning:</span>
                <p className="text-xs text-gray-400 mt-1">{report.triage.reasoning}</p>
              </div>
            </div>
          </ExpandableSection>
        </>
      )}
    </div>
  );
}

// ============================================================================
// IntelligenceReportList - List of expandable report cards
// ============================================================================

interface IntelligenceReportListProps {
  reports: DocumentIntelligenceReport[];
  onRatingOverride: (documentId: string, newRating: Partial<NATORating>, reason: string) => void;
}

export function IntelligenceReportList({ reports, onRatingOverride }: IntelligenceReportListProps) {
  const sortedReports = [...reports];

  if (sortedReports.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-8 text-center">
        <p className="text-sm text-gray-500">No intelligence reports available.</p>
        <p className="text-xs text-gray-600 mt-1">Upload and process documents to generate reports.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedReports.map((report) => (
        <IntelligenceReport
          key={report.documentId}
          report={report}
          onRatingOverride={(newRating, reason) =>
            onRatingOverride(report.documentId, newRating, reason)
          }
        />
      ))}
    </div>
  );
}
