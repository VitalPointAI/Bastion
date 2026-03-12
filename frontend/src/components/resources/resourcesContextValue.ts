/**
 * resourcesContextValue — React context object for Resources tab shared state.
 *
 * Separated from ResourcesContext.tsx so that the component file only exports
 * components (required by react-refresh/only-export-components).
 */

import { createContext } from 'react';

export interface ResourcesContextValue {
  selectedResourceId: string | null;
  setSelectedResourceId: (id: string | null) => void;
}

export const ResourcesContext = createContext<ResourcesContextValue | null>(null);
