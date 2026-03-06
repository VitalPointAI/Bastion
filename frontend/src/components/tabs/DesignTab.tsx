import { DoctrinalPlaceholder } from './DoctrinalPlaceholder.js';

interface DesignTabProps {
  problemSetId: string;
}

export function DesignTab({ problemSetId: _problemSetId }: DesignTabProps) {
  return (
    <DoctrinalPlaceholder
      tabId="design"
      tabName="Design"
      description="Operational Design translates strategic guidance into an operational approach. This is where commanders and planners develop the broad concept for achieving objectives."
      futureContent="Operational design workspace with center of gravity analysis, lines of effort/operation, decisive points, and operational approach visualization."
      deliveredBy="Phase 25"
    />
  );
}
