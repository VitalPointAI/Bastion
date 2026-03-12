/**
 * resourcesContextValue — React context object and hook for Resources tab shared state.
 *
 * Separated from ResourcesContext.tsx so that the component file only exports
 * components (required by react-refresh/only-export-components).
 */

import { createContext, useContext } from 'react';

export interface ResourcesContextValue {
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
}

export const ResourcesContext = createContext<ResourcesContextValue | null>(null);

export function useResourcesContext(): ResourcesContextValue {
  const ctx = useContext(ResourcesContext);
  if (!ctx) {
    throw new Error('useResourcesContext must be used inside <ResourcesProvider>');
  }
  return ctx;
}
