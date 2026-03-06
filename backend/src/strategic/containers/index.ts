/**
 * Strategic Containers Module
 * Re-exports types and store, provides singleton instance.
 */

export * from './types.js';
export { ContainerStore, initContainerTables } from './store.js';

import { ContainerStore } from './store.js';

/**
 * Singleton container store instance.
 */
export const containerStore = new ContainerStore();
