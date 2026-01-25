import type { COA } from './types';
import './COAEditor.css';

interface COACardProps {
  coa: COA;
  isSelected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}

export function COACard({ coa, isSelected, onSelect, onEdit }: COACardProps) {
  const cardClasses = ['coa-card'];
  if (isSelected) cardClasses.push('selected');
  if (coa.selected) cardClasses.push('approved');

  return (
    <div className={cardClasses.join(' ')}>
      <div className="coa-card-header">
        <span className="coa-number">COA {coa.number}</span>
        {coa.selected && <span className="coa-approved-badge">Selected</span>}
        {coa.comparisonScore && (
          <span className="coa-score">
            Score: {coa.comparisonScore.overallScore}/100
            {coa.comparisonScore.ranking === 1 && ' (Top Ranked)'}
          </span>
        )}
      </div>

      <h4 className="coa-name">{coa.name}</h4>
      <p className="coa-description">{coa.description}</p>

      {coa.redTeamResults && (
        <div className="coa-red-team">
          <span className="red-team-label">Red Team:</span>
          <span className="vulnerability-count">
            {coa.redTeamResults.vulnerabilities.length} vulnerabilities
          </span>
          <span className="confidence">
            ({coa.redTeamResults.confidenceScore}% confidence)
          </span>
        </div>
      )}

      <div className="coa-card-actions">
        <button className="coa-edit-btn" onClick={onEdit}>
          Edit
        </button>
        {!coa.selected && (
          <button className="coa-select-btn" onClick={onSelect}>
            Select for Approval
          </button>
        )}
      </div>
    </div>
  );
}
