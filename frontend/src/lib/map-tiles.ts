/**
 * Shared map tile configuration.
 *
 * Uses MapTiler (English labels guaranteed) when VITE_MAPTILER_KEY is set,
 * otherwise falls back to CARTO dark tiles (Latin/English at most zoom levels).
 */

const MAPTILER_KEY = import.meta.env.VITE_MAPTILER_KEY as string | undefined;

/** Dark base-map tile URL with English labels */
export const DARK_TILE_URL = MAPTILER_KEY
  ? `https://api.maptiler.com/maps/dataviz-dark/{z}/{x}/{y}.png?key=${MAPTILER_KEY}`
  : 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png';

/** Attribution string matching the active tile provider */
export const DARK_TILE_ATTRIBUTION = MAPTILER_KEY
  ? '&copy; <a href="https://www.maptiler.com/copyright/">MapTiler</a> &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

/** Subdomains for the tile URL (CARTO uses abcd, MapTiler uses none) */
export const DARK_TILE_SUBDOMAINS = MAPTILER_KEY ? undefined : 'abcd';
