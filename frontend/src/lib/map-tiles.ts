/**
 * Shared map tile configuration.
 *
 * Uses MapTiler (English labels guaranteed) when VITE_MAPTILER_KEY is set,
 * otherwise falls back to CARTO tiles (Latin/English at most zoom levels).
 *
 * Two variants:
 *   - DARK_TILE_*  — dark theme for planning/mission maps
 *   - LIGHT_TILE_* — lighter theme for the COP map (better readability)
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

const CARTO_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

const MAPTILER_ATTRIBUTION =
  '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Dark base-map tile URL */
export const DARK_TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

export const DARK_TILE_ATTRIBUTION = MAPTILER_KEY ? MAPTILER_ATTRIBUTION : CARTO_ATTRIBUTION;
export const DARK_TILE_SUBDOMAINS = MAPTILER_KEY ? undefined : 'abcd';

/** Light base-map tile URL — dark matter with labels for better readability */
export const LIGHT_TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/voyager/{z}/{x}/{y}{r}.png';

export const LIGHT_TILE_ATTRIBUTION = MAPTILER_KEY ? MAPTILER_ATTRIBUTION : CARTO_ATTRIBUTION;
export const LIGHT_TILE_SUBDOMAINS = MAPTILER_KEY ? undefined : 'abcd';
