/**
 * ResourcesContext
 *
 * Shared selection state for the Resources tab. Provides cross-view
 * highlighting so that selecting a resource in Inventory can highlight
 * the same node in Network, and vice-versa.
 *
 * Phase 42 Plan 01: Initial shell — selectedResourceId only.
 */

import { useContext, useState, type ReactNode } from 'react';
import { ResourcesContext } from './resourcesContextValue.js';
import type { ResourcesContextValue } from './resourcesContextValue.js';

interface ResourcesProviderProps {
  children: ReactNode;
}

export function ResourcesProvider({ children }: ResourcesProviderProps) {
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null);

  return (
    <ResourcesContext.Provider value={{ selectedResourceId, setSelectedResourceId }}>
      {children}
    </ResourcesContext.Provider>
  );
}

export function useResourcesContext(): ResourcesContextValue {
  const ctx = useContext(ResourcesContext);
  if (!ctx) {
    throw new Error('useResourcesContext must be used inside <ResourcesProvider>');
  }
  return ctx;
}
