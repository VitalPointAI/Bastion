/**
 * SustainmentDisplay Component
 *
 * Dual-view visualization for COA sustainment analysis (MDMP-3-07, MDMP-5-03):
 * 1. Burndown Chart: Resource consumption trends over phases
 * 2. Risk Flags: Phase-level risk indicators (green/amber/red)
 *
 * Enables comparison across multiple COAs for logistics feasibility assessment.
 */

import React, { useState } from 'react';
import './SustainmentDisplay.css';

// ============================================================================
// Frontend Type Definitions (Mirror backend sustainment-model.ts)
// ============================================================================

export type ResourceCategoryFE =
  | 'ammunition'
  | 'fuel'
  | 'food_water'
  | 'medical'
  | 'maintenance_parts'
  | 'other';

export type RiskLevelFE = 'green' | 'amber' | 'red';

export interface BurndownPointFE {
  phase: number;
  phaseName: string;
  remaining: number;
  consumed: number;
  resupplied: number;
  riskLevel: RiskLevelFE;
}

export interface ResourceBurndownFE {
  resourceName: string;
  category: ResourceCategoryFE;
  unit: string;
  points: BurndownPointFE[];
  exhaustionPhase: number | null;
  shortfallAmount: number;
}

export interface PhaseRiskAssessmentFE {
  phase: number;
  phaseName: string;
  overallRisk: RiskLevelFE;
  atRiskResources: string[];
  sustainable: boolean;
}

export type FeasibilityLevelFE = 'feasible' | 'marginal' | 'infeasible';

export interface SustainmentModelResultFE {
  coaId: string;
  coaName: string;
  burndowns: ResourceBurndownFE[];
  phaseRisks: PhaseRiskAssessmentFE[];
  overallFeasibility: FeasibilityLevelFE;
  criticalPhase: number | null;
  summary: string;
  recommendations: string[];
}

// ============================================================================
// Component Props
// ============================================================================

interface SustainmentDisplayProps {
  result: SustainmentModelResultFE;
  comparisonResults?: SustainmentModelResultFE[];
}

// ============================================================================
// Main Component
// ============================================================================

const SustainmentDisplay: React.FC<SustainmentDisplayProps> = ({
  result,
  comparisonResults = []
}) => {
  const [activeView, setActiveView] = useState<'burndown' | 'risk'>('burndown');
  const [hoveredPoint, setHoveredPoint] = useState<{
    resourceName: string;
    phase: number;
  } | null>(null);

  const allResults = [result, ...comparisonResults];

  // ============================================================================
  // Render Functions
  // ============================================================================

  const renderAssessmentBanner = () => {
    const bannerClass = `assessment-banner assessment-${result.overallFeasibility}`;
    return (
      <div className={bannerClass}>
        <div className="assessment-content">
          <span className="assessment-label">
            {result.overallFeasibility.toUpperCase()}
          </span>
          <span className="assessment-summary">{result.summary}</span>
        </div>
      </div>
    );
  };

  const renderTabs = () => {
    return (
      <div className="view-tabs">
        <button
          className={`tab ${activeView === 'burndown' ? 'active' : ''}`}
          onClick={() => setActiveView('burndown')}
        >
          Burndown Chart
        </button>
        <button
          className={`tab ${activeView === 'risk' ? 'active' : ''}`}
          onClick={() => setActiveView('risk')}
        >
          Risk Flags
        </button>
      </div>
    );
  };

  const renderBurndownChart = () => {
    if (result.burndowns.length === 0) {
      return <div className="empty-state">No resource data available</div>;
    }

    // Chart dimensions
    const width = 800;
    const height = 400;
    const padding = { top: 40, right: 150, bottom: 60, left: 80 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Calculate scales
    const phaseCount = result.burndowns[0].points.length;
    const xScale = (phase: number) => padding.left + (phase / (phaseCount - 1)) * chartWidth;

    // Find max remaining across all resources and COAs
    let maxRemaining = 0;
    for (const res of allResults) {
      for (const burndown of res.burndowns) {
        for (const point of burndown.points) {
          if (point.remaining > maxRemaining) {
            maxRemaining = point.remaining;
          }
        }
      }
    }

    const yScale = (remaining: number) =>
      padding.top + chartHeight - (remaining / maxRemaining) * chartHeight;

    // Line styles for comparison
    const getLineStyle = (coaIndex: number) => {
      const styles = ['solid', 'dashed', 'dotted'];
      return styles[coaIndex % styles.length];
    };

    const getStrokeDasharray = (style: string) => {
      switch (style) {
        case 'dashed':
          return '5,5';
        case 'dotted':
          return '2,3';
        default:
          return 'none';
      }
    };

    // Color palette for resources
    const colors = [
      '#2563eb', // blue
      '#dc2626', // red
      '#16a34a', // green
      '#ea580c', // orange
      '#7c3aed', // purple
      '#0891b2'  // cyan
    ];

    return (
      <div className="burndown-chart-container">
        <svg width={width} height={height} className="burndown-chart">
          {/* Grid lines */}
          <g className="grid">
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const y = padding.top + chartHeight * (1 - fraction);
              return (
                <line
                  key={fraction}
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartWidth}
                  y2={y}
                  className="grid-line"
                />
              );
            })}
          </g>

          {/* Y-axis labels */}
          <g className="y-axis">
            {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
              const y = padding.top + chartHeight * (1 - fraction);
              const value = Math.round(maxRemaining * fraction);
              return (
                <text
                  key={fraction}
                  x={padding.left - 10}
                  y={y + 5}
                  className="axis-label"
                  textAnchor="end"
                >
                  {value}
                </text>
              );
            })}
            <text
              x={padding.left - 50}
              y={padding.top + chartHeight / 2}
              className="axis-title"
              textAnchor="middle"
              transform={`rotate(-90 ${padding.left - 50} ${padding.top + chartHeight / 2})`}
            >
              Remaining Quantity
            </text>
          </g>

          {/* X-axis */}
          <g className="x-axis">
            <line
              x1={padding.left}
              y1={padding.top + chartHeight}
              x2={padding.left + chartWidth}
              y2={padding.top + chartHeight}
              className="axis-line"
            />
            {result.burndowns[0].points.map((point, idx) => (
              <g key={idx}>
                <line
                  x1={xScale(idx)}
                  y1={padding.top + chartHeight}
                  x2={xScale(idx)}
                  y2={padding.top + chartHeight + 5}
                  className="tick"
                />
                <text
                  x={xScale(idx)}
                  y={padding.top + chartHeight + 20}
                  className="axis-label"
                  textAnchor="middle"
                >
                  {point.phaseName}
                </text>
              </g>
            ))}
            <text
              x={padding.left + chartWidth / 2}
              y={height - 10}
              className="axis-title"
              textAnchor="middle"
            >
              Execution Phase
            </text>
          </g>

          {/* Threshold lines */}
          {result.burndowns.map((burndown, resourceIdx) => {
            // Find critical and warning thresholds from first point (they're constant)
            // We need to derive these from the risk levels
            // For display purposes, we'll use 25% and 50% of starting quantity
            const startingQuantity = burndown.points[0].remaining + burndown.points[0].consumed;
            const criticalThreshold = startingQuantity * 0.2;
            const warningThreshold = startingQuantity * 0.4;

            return (
              <g key={`thresholds-${resourceIdx}`}>
                <line
                  x1={padding.left}
                  y1={yScale(criticalThreshold)}
                  x2={padding.left + chartWidth}
                  y2={yScale(criticalThreshold)}
                  className="threshold-critical"
                  strokeDasharray="3,3"
                />
                <line
                  x1={padding.left}
                  y1={yScale(warningThreshold)}
                  x2={padding.left + chartWidth}
                  y2={yScale(warningThreshold)}
                  className="threshold-warning"
                  strokeDasharray="3,3"
                />
              </g>
            );
          })}

          {/* Resource lines */}
          {allResults.map((coaResult, coaIdx) =>
            coaResult.burndowns.map((burndown, resourceIdx) => {
              const color = colors[resourceIdx % colors.length];
              const lineStyle = getLineStyle(coaIdx);
              const strokeDasharray = getStrokeDasharray(lineStyle);

              // Generate path
              const pathData = burndown.points
                .map((point, idx) => {
                  const x = xScale(idx);
                  const y = yScale(point.remaining);
                  return idx === 0 ? `M ${x} ${y}` : `L ${x} ${y}`;
                })
                .join(' ');

              return (
                <g key={`${coaIdx}-${resourceIdx}`}>
                  <path
                    d={pathData}
                    fill="none"
                    stroke={color}
                    strokeWidth="2"
                    strokeDasharray={strokeDasharray}
                    className="resource-line"
                  />
                  {/* Data points */}
                  {burndown.points.map((point, idx) => (
                    <circle
                      key={idx}
                      cx={xScale(idx)}
                      cy={yScale(point.remaining)}
                      r="4"
                      fill={color}
                      className="data-point"
                      onMouseEnter={() =>
                        setHoveredPoint({ resourceName: burndown.resourceName, phase: idx })
                      }
                      onMouseLeave={() => setHoveredPoint(null)}
                    />
                  ))}
                </g>
              );
            })
          )}

          {/* Hover tooltip */}
          {hoveredPoint &&
            allResults.map((coaResult) => {
              const burndown = coaResult.burndowns.find(
                (b) => b.resourceName === hoveredPoint.resourceName
              );
              if (!burndown) return null;

              const point = burndown.points[hoveredPoint.phase];
              const x = xScale(hoveredPoint.phase);
              const y = yScale(point.remaining);

              return (
                <g key={`tooltip-${coaResult.coaId}`} className="tooltip">
                  <rect
                    x={x + 10}
                    y={y - 40}
                    width="160"
                    height="70"
                    className="tooltip-bg"
                  />
                  <text x={x + 15} y={y - 25} className="tooltip-text">
                    {burndown.resourceName}
                  </text>
                  <text x={x + 15} y={y - 10} className="tooltip-text">
                    Remaining: {point.remaining.toFixed(0)} {burndown.unit}
                  </text>
                  <text x={x + 15} y={y + 5} className="tooltip-text">
                    Consumed: {point.consumed.toFixed(0)} {burndown.unit}
                  </text>
                  <text x={x + 15} y={y + 20} className="tooltip-text">
                    Risk: {point.riskLevel}
                  </text>
                </g>
              );
            })}
        </svg>

        {/* Legend */}
        <div className="chart-legend">
          {allResults.map((coaResult, coaIdx) => (
            <div key={coaResult.coaId} className="legend-coa">
              <div className="legend-coa-name">{coaResult.coaName}</div>
              {coaResult.burndowns.map((burndown, resourceIdx) => {
                const color = colors[resourceIdx % colors.length];
                const lineStyle = getLineStyle(coaIdx);
                return (
                  <div key={resourceIdx} className="legend-item">
                    <svg width="30" height="2">
                      <line
                        x1="0"
                        y1="1"
                        x2="30"
                        y2="1"
                        stroke={color}
                        strokeWidth="2"
                        strokeDasharray={getStrokeDasharray(lineStyle)}
                      />
                    </svg>
                    <span>{burndown.resourceName}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderRiskFlags = () => {
    return (
      <div className="risk-flags-container">
        <table className="risk-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th>Overall Risk</th>
              {result.burndowns.map((burndown) => (
                <th key={burndown.resourceName}>{burndown.resourceName}</th>
              ))}
              <th>Sustainable</th>
            </tr>
          </thead>
          <tbody>
            {result.phaseRisks.map((phaseRisk) => (
              <tr key={phaseRisk.phase}>
                <td className="phase-cell">{phaseRisk.phaseName}</td>
                <td className="risk-cell">
                  <span className={`risk-indicator risk-${phaseRisk.overallRisk}`}>
                    {phaseRisk.overallRisk.toUpperCase()}
                  </span>
                </td>
                {result.burndowns.map((burndown) => {
                  const point = burndown.points[phaseRisk.phase];
                  return (
                    <td key={burndown.resourceName} className="resource-cell">
                      <span className={`risk-indicator risk-${point.riskLevel}`}>
                        {point.riskLevel}
                      </span>
                      <span className="resource-value">
                        {point.remaining.toFixed(0)} {burndown.unit}
                      </span>
                    </td>
                  );
                })}
                <td className="sustainable-cell">
                  {phaseRisk.sustainable ? '✓' : '✗'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Comparison table if multiple COAs */}
        {comparisonResults.length > 0 && (
          <div className="comparison-section">
            <h3>COA Comparison</h3>
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>COA</th>
                  <th>Feasibility</th>
                  <th>Critical Phase</th>
                  <th>At-Risk Resources</th>
                </tr>
              </thead>
              <tbody>
                {allResults.map((coaResult) => (
                  <tr key={coaResult.coaId}>
                    <td>{coaResult.coaName}</td>
                    <td className={`feasibility-${coaResult.overallFeasibility}`}>
                      {coaResult.overallFeasibility}
                    </td>
                    <td>
                      {coaResult.criticalPhase !== null
                        ? result.phaseRisks[coaResult.criticalPhase]?.phaseName
                        : 'None'}
                    </td>
                    <td>
                      {coaResult.phaseRisks
                        .flatMap((pr) => pr.atRiskResources)
                        .filter((v, i, a) => a.indexOf(v) === i)
                        .join(', ') || 'None'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const renderRecommendations = () => {
    if (result.recommendations.length === 0) return null;

    return (
      <div className="recommendations-section">
        <h3>Recommendations</h3>
        <ul className="recommendations-list">
          {result.recommendations.map((rec, idx) => (
            <li key={idx}>{rec}</li>
          ))}
        </ul>
      </div>
    );
  };

  // ============================================================================
  // Main Render
  // ============================================================================

  return (
    <div className="sustainment-display">
      {renderAssessmentBanner()}
      {renderTabs()}
      <div className="view-content">
        {activeView === 'burndown' ? renderBurndownChart() : renderRiskFlags()}
      </div>
      {renderRecommendations()}
    </div>
  );
};

export default SustainmentDisplay;
