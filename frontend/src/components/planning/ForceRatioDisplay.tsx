/**
 * ForceRatioDisplay Component
 *
 * Dual-display visualization for force ratio analysis:
 * 1. Side-by-side horizontal bars (friendly vs adversary by category)
 * 2. Detailed numeric table (toggle on demand)
 *
 * Shows correlation of forces and means (COFM) results with:
 * - Visual bar comparison (blue = friendly, red = adversary)
 * - Doctrinal threshold indicators (dashed lines)
 * - Overall ratio as prominent number
 * - Overall assessment badge (green/amber/red)
 * - Combat power modifiers summary
 * - Detailed numeric breakdown table
 */

import React, { useState } from 'react';
import './ForceRatioDisplay.css';

// ==========================================================================
// Type Definitions (mirror backend types)
// ==========================================================================

interface CombatPowerModifiers {
  training: number;
  technology: number;
  morale: number;
  terrain: number;
  logistics: number;
  intelligence: number;
  leadership: number;
}

interface DoctrinalThreshold {
  operationType: string;
  requiredRatio: number;
  source: string;
}

interface CategoryRatio {
  name: string;
  rawRatio: number;
  weightedRatio: number;
  friendlyEffective: number;
  adversaryEffective: number;
  unit: string;
}

interface ThresholdAssessment {
  threshold: DoctrinalThreshold;
  met: boolean;
  currentRatio: number;
  gap: number;
}

interface ForceRatioResultData {
  overallRatio: number;
  categoryRatios: CategoryRatio[];
  modifiers: CombatPowerModifiers;
  modifierEffect: number;
  thresholdAssessments: ThresholdAssessment[];
  adversaryAdvantages: string[];
  friendlyAdvantages: string[];
  overallAssessment: 'favorable' | 'marginal' | 'unfavorable';
  recommendations: string[];
}

// ==========================================================================
// Component Props
// ==========================================================================

interface ForceRatioDisplayProps {
  result: ForceRatioResultData;
  operationType?: string;
  showDetailTable?: boolean;
}

// ==========================================================================
// Component
// ==========================================================================

export const ForceRatioDisplay: React.FC<ForceRatioDisplayProps> = ({
  result,
  operationType,
  showDetailTable: initialShowDetail = false,
}) => {
  const [showDetailTable, setShowDetailTable] = useState(initialShowDetail);

  // Find relevant threshold for operation type (if provided)
  const relevantThreshold = operationType
    ? result.thresholdAssessments.find((a) =>
        a.threshold.operationType.toLowerCase().includes(operationType.toLowerCase())
      )
    : null;

  // Determine assessment badge style
  const assessmentClass = `assessment-badge ${result.overallAssessment}`;

  // Format ratio for display
  const formatRatio = (ratio: number): string => {
    if (ratio === Infinity) return '∞:1';
    return `${ratio.toFixed(1)}:1`;
  };

  // Calculate max effective strength for bar scaling
  const maxEffective = Math.max(
    ...result.categoryRatios.flatMap((cat) => [cat.friendlyEffective, cat.adversaryEffective])
  );

  return (
    <div className="force-ratio-display">
      {/* Overall Ratio Header */}
      <div className="ratio-header">
        <div className="ratio-main">
          <span className="ratio-label">Overall Force Ratio</span>
          <span className="ratio-value">{formatRatio(result.overallRatio)}</span>
          <span className={assessmentClass}>
            {result.overallAssessment.toUpperCase()}
          </span>
        </div>
        {relevantThreshold && (
          <div className="threshold-indicator">
            <span className={`threshold-status ${relevantThreshold.met ? 'met' : 'unmet'}`}>
              {relevantThreshold.met ? '✓' : '✗'}
            </span>
            <span className="threshold-label">
              {relevantThreshold.threshold.operationType} threshold:{' '}
              {formatRatio(relevantThreshold.threshold.requiredRatio)}
              {!relevantThreshold.met && (
                <span className="threshold-gap"> (gap: {formatRatio(Math.abs(relevantThreshold.gap))})</span>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Side-by-Side Bar Chart */}
      <div className="bar-chart">
        <div className="chart-header">
          <span className="friendly-label">Friendly</span>
          <span className="category-label">Category</span>
          <span className="adversary-label">Adversary</span>
        </div>

        {result.categoryRatios.map((cat, idx) => {
          const friendlyWidth = (cat.friendlyEffective / maxEffective) * 100;
          const adversaryWidth = (cat.adversaryEffective / maxEffective) * 100;

          return (
            <div key={idx} className="category-row">
              <div className="friendly-bar-container">
                <div
                  className="friendly-bar"
                  style={{ width: `${friendlyWidth}%` }}
                  title={`${cat.friendlyEffective.toFixed(1)} effective`}
                >
                  <span className="bar-value">{cat.friendlyEffective.toFixed(0)}</span>
                </div>
              </div>

              <div className="category-name">
                {cat.name}
                <span className="category-unit">({cat.unit})</span>
              </div>

              <div className="adversary-bar-container">
                <div
                  className="adversary-bar"
                  style={{ width: `${adversaryWidth}%` }}
                  title={`${cat.adversaryEffective.toFixed(1)} effective`}
                >
                  <span className="bar-value">{cat.adversaryEffective.toFixed(0)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Combat Power Modifiers Summary */}
      <div className="modifiers-summary">
        <h4>Combat Power Modifiers</h4>
        <div className="modifier-grid">
          {Object.entries(result.modifiers).map(([key, value]) => (
            <div key={key} className="modifier-item">
              <span className="modifier-name">{key.charAt(0).toUpperCase() + key.slice(1)}</span>
              <span className={`modifier-value ${value > 0 ? 'positive' : value < 0 ? 'negative' : 'neutral'}`}>
                {value > 0 ? '+' : ''}{value.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
        <div className="modifier-effect">
          Overall modifier effect: <strong>{result.modifierEffect.toFixed(2)}x</strong>
        </div>
      </div>

      {/* Recommendations */}
      {result.recommendations.length > 0 && (
        <div className="recommendations">
          <h4>Recommendations</h4>
          <ul>
            {result.recommendations.map((rec, idx) => (
              <li key={idx}>{rec}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Toggle Detail Table */}
      <button
        className="toggle-detail-btn"
        onClick={() => setShowDetailTable(!showDetailTable)}
      >
        {showDetailTable ? '▲ Hide' : '▼ Show'} Detailed Numeric Table
      </button>

      {/* Detailed Numeric Table */}
      {showDetailTable && (
        <div className="detail-table-container">
          <table className="detail-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Friendly</th>
                <th>Adversary</th>
                <th>Unit</th>
                <th>Raw Ratio</th>
                <th>Weighted Ratio</th>
                <th>Assessment</th>
              </tr>
            </thead>
            <tbody>
              {result.categoryRatios.map((cat, idx) => {
                const assessment =
                  cat.weightedRatio > 1.5
                    ? 'Friendly Advantage'
                    : cat.weightedRatio < 1.0
                    ? 'Adversary Advantage'
                    : 'Even';
                const assessmentClass =
                  cat.weightedRatio > 1.5
                    ? 'favorable'
                    : cat.weightedRatio < 1.0
                    ? 'unfavorable'
                    : 'marginal';

                return (
                  <tr key={idx}>
                    <td className="category-name-cell">{cat.name}</td>
                    <td className="numeric-cell">{cat.friendlyEffective.toFixed(1)}</td>
                    <td className="numeric-cell">{cat.adversaryEffective.toFixed(1)}</td>
                    <td className="unit-cell">{cat.unit}</td>
                    <td className="numeric-cell">{formatRatio(cat.rawRatio)}</td>
                    <td className="numeric-cell">{formatRatio(cat.weightedRatio)}</td>
                    <td className={`assessment-cell ${assessmentClass}`}>{assessment}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Threshold Assessments Table */}
          <div className="threshold-table-section">
            <h4>Doctrinal Threshold Assessments</h4>
            <table className="threshold-table">
              <thead>
                <tr>
                  <th>Operation Type</th>
                  <th>Required Ratio</th>
                  <th>Current Ratio</th>
                  <th>Status</th>
                  <th>Gap</th>
                  <th>Source</th>
                </tr>
              </thead>
              <tbody>
                {result.thresholdAssessments.map((assessment, idx) => (
                  <tr key={idx} className={assessment.met ? 'threshold-met' : 'threshold-unmet'}>
                    <td>{assessment.threshold.operationType}</td>
                    <td className="numeric-cell">{formatRatio(assessment.threshold.requiredRatio)}</td>
                    <td className="numeric-cell">{formatRatio(assessment.currentRatio)}</td>
                    <td className="status-cell">
                      <span className={`status-badge ${assessment.met ? 'met' : 'unmet'}`}>
                        {assessment.met ? '✓ Met' : '✗ Unmet'}
                      </span>
                    </td>
                    <td className="numeric-cell">
                      {assessment.met ? '—' : formatRatio(Math.abs(assessment.gap))}
                    </td>
                    <td className="source-cell">{assessment.threshold.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
