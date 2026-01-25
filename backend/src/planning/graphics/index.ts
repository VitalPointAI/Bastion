/**
 * Operational Graphics Module
 *
 * Phase 05 Plan 10: Exports symbol renderer and graphics generator
 */

export { renderSymbol, getSymbolAnchor, getSymbolSize, GRAPHIC_SIDC } from './symbol-renderer.js';
export type { SymbolOptions } from './symbol-renderer.js';

export {
  generateOperationalGraphics,
  graphicsToGeoJSON,
} from './operational-graphics.js';
export type { OperationalGraphic, OperationalOverlay } from './operational-graphics.js';
