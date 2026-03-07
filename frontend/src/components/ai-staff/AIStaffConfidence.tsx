/**
 * AIStaffConfidence -- Doctrinal confidence badge
 *
 * Small pill badge with label and color from CONFIDENCE_STYLES.
 * Confirmed=green, Probable=blue, Possible=yellow, Doubtful=red.
 */

import type { DoctrinalConfidence } from '../../types/ai-staff.ts';
import { CONFIDENCE_STYLES } from '../../types/ai-staff.ts';

interface AIStaffConfidenceProps {
  confidence: DoctrinalConfidence;
}

export function AIStaffConfidence({ confidence }: AIStaffConfidenceProps) {
  const style = CONFIDENCE_STYLES[confidence];

  return (
    <span
      className="ai-staff-badge"
      style={{
        color: style.color,
        background: `color-mix(in srgb, ${style.color} 15%, transparent)`,
      }}
    >
      {style.label}
    </span>
  );
}
