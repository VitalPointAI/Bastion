/**
 * useIronclawDataRefresh
 *
 * Reusable hook for any component that needs to re-fetch data when
 * Ironclaw updates a specific domain via SSE. Subscribes to the
 * data_updated SSE event and calls the provided reload callback
 * when the domain and problemSetId match.
 *
 * Usage:
 *   useIronclawDataRefresh('design', problemSetId, loadDesign);
 *   useIronclawDataRefresh('intel', problemSetId, loadPIRs);
 */

import { useEffect } from 'react';
import { useIronclawContext } from '../context/IronclawContext.tsx';

export function useIronclawDataRefresh(
  domain: string,
  problemSetId: string | null | undefined,
  onRefresh: () => void,
): void {
  const { onDataUpdate } = useIronclawContext();

  useEffect(() => {
    if (!problemSetId) return;
    return onDataUpdate((payload) => {
      if (payload.domain === domain && payload.problemSetId === problemSetId) {
        onRefresh();
      }
    });
  }, [onDataUpdate, domain, problemSetId, onRefresh]);
}
