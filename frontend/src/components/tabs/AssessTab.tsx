import { DoctrinalPlaceholder } from './DoctrinalPlaceholder.js';

interface AssessTabProps {
  problemSetId: string;
}

export function AssessTab({ problemSetId: _problemSetId }: AssessTabProps) {
  return (
    <DoctrinalPlaceholder
      tabId="assess"
      tabName="Assess"
      description="Assessment measures progress toward accomplishing objectives and determines the effectiveness of ongoing operations. It enables adaptation of plans and operations."
      futureContent="Measures of effectiveness (MOEs), measures of performance (MOPs), assessment dashboards, and reframing triggers."
      deliveredBy="Phase 28+"
    />
  );
}
