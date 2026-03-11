import { BrainController } from '../brain/BrainController.js';
import { InheritedContextSection } from '../inheritance/InheritedContextSection.tsx';
import { DecisionGateBanner } from '../governance/index.js';

interface UnderstandTabProps {
  problemSetId: string;
}

export function UnderstandTab({ problemSetId }: UnderstandTabProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Inherited context from parent problem sets */}
      {problemSetId && (
        <InheritedContextSection problemSetId={problemSetId} />
      )}

      {/* Decision gate banner for commanders */}
      <DecisionGateBanner tabId="understand" />

      {/* Brain visualization — replaces the old TabLayout + sidebar views */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <BrainController problemSetId={problemSetId} />
      </div>
    </div>
  );
}
