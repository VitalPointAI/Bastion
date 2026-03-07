/**
 * Plugin Loader — Convention-based Auto-Discovery
 *
 * Phase 27 Plan 02: Discovers resource plugins by scanning the plugins directory
 * for files matching the *-plugin.ts (or .js) naming convention.
 */

import { readdir } from 'fs/promises';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { ResourcePlugin } from './base-plugin.js';

/** Files to skip during discovery — infrastructure, not plugins */
const SKIP_FILES = ['base-plugin', 'plugin-loader', 'plugin-registry'];

/**
 * Scan the plugins directory and dynamically import all resource plugins.
 *
 * Convention: any file ending in `-plugin.ts` or `-plugin.js` (excluding SKIP_FILES)
 * is treated as a resource plugin. Each must have a default export implementing ResourcePlugin.
 *
 * @returns Map from category string to plugin instance
 */
export async function loadPlugins(): Promise<Map<string, ResourcePlugin>> {
  const plugins = new Map<string, ResourcePlugin>();

  const pluginDir = fileURLToPath(new URL('./', import.meta.url));
  const entries = await readdir(pluginDir);

  for (const entry of entries) {
    // Match files ending in -plugin.ts or -plugin.js
    const match = entry.match(/^(.+)-plugin\.(ts|js)$/);
    if (!match) continue;

    const baseName = `${match[1]}-plugin`;
    if (SKIP_FILES.includes(baseName)) continue;

    try {
      const modulePath = join(pluginDir, entry);
      const mod = await import(modulePath);
      const plugin: ResourcePlugin | undefined = mod.default ?? mod.plugin;

      if (!plugin || typeof plugin.category !== 'string') {
        console.warn(`[PluginLoader] Skipping ${entry}: no valid plugin export found`);
        continue;
      }

      plugins.set(plugin.category, plugin);
      console.log('[PluginLoader] Discovered plugin:', plugin.category, plugin.displayName);
    } catch (err) {
      console.error(`[PluginLoader] Failed to load ${entry}:`, err);
    }
  }

  return plugins;
}
