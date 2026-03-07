/**
 * Plugin Loader — Convention-based Auto-Discovery + Hot-Loading
 *
 * Phase 27 Plan 02: Discovers resource plugins by scanning the plugins directory
 * for files matching the *-plugin.ts (or .js) naming convention.
 *
 * Phase 32 Plan 02: Extended to scan generated/ subdirectory for Ironclaw-generated
 * plugins, with file watcher for runtime hot-loading without restart.
 */

import { readdir, mkdir } from 'fs/promises';
import { watch } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import type { ResourcePlugin } from './base-plugin.js';

/** Files to skip during discovery — infrastructure, not plugins */
const SKIP_FILES = ['base-plugin', 'plugin-loader', 'plugin-registry'];

/** Debounce interval for file watcher events (ms) */
const WATCH_DEBOUNCE_MS = 300;

/**
 * Load plugins from a single directory into the provided map.
 *
 * Scans for files matching *-plugin.(ts|js) convention, dynamically imports them,
 * and validates they export a valid ResourcePlugin with a category string.
 *
 * @param dir - Absolute path to directory to scan
 * @param plugins - Map to populate with discovered plugins
 */
async function loadFromDirectory(
  dir: string,
  plugins: Map<string, ResourcePlugin>,
): Promise<void> {
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    // Directory doesn't exist or isn't readable — skip silently
    return;
  }

  for (const entry of entries) {
    // Match files ending in -plugin.ts or -plugin.js
    const match = entry.match(/^(.+)-plugin\.(ts|js)$/);
    if (!match) continue;

    const baseName = `${match[1]}-plugin`;
    if (SKIP_FILES.includes(baseName)) continue;

    try {
      const modulePath = join(dir, entry);
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
}

/**
 * Scan the plugins directory and generated/ subdirectory, dynamically importing
 * all resource plugins found.
 *
 * Convention: any file ending in `-plugin.ts` or `-plugin.js` (excluding SKIP_FILES)
 * is treated as a resource plugin. Each must have a default export implementing ResourcePlugin.
 *
 * @returns Map from category string to plugin instance
 */
export async function loadPlugins(): Promise<Map<string, ResourcePlugin>> {
  const plugins = new Map<string, ResourcePlugin>();

  const pluginDir = fileURLToPath(new URL('./', import.meta.url));
  const generatedDir = join(pluginDir, 'generated');

  // Ensure generated/ directory exists for Ironclaw-generated plugins
  await mkdir(generatedDir, { recursive: true });

  // Load static plugins from main directory
  await loadFromDirectory(pluginDir, plugins);

  // Load Ironclaw-generated plugins from generated/ subdirectory
  await loadFromDirectory(generatedDir, plugins);

  return plugins;
}

/**
 * Watch the generated/ directory for new Ironclaw-generated plugins and
 * hot-load them at runtime without server restart.
 *
 * Uses fs.watch with debouncing to handle rapid file creation events
 * (e.g., USB-style enumeration). All load attempts are logged for audit.
 *
 * @param onNewPlugin - Callback invoked when a valid new plugin is loaded
 */
export function watchForNewPlugins(
  onNewPlugin: (plugin: ResourcePlugin) => void,
): void {
  const pluginDir = fileURLToPath(new URL('./', import.meta.url));
  const generatedDir = join(pluginDir, 'generated');

  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  const pendingFiles = new Set<string>();

  watch(generatedDir, (_eventType, filename) => {
    if (!filename) return;

    // Only process plugin files
    const match = filename.match(/^(.+)-plugin\.(js)$/);
    if (!match) return;

    pendingFiles.add(filename);

    // Debounce: wait for rapid events to settle
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      const filesToProcess = Array.from(pendingFiles);
      pendingFiles.clear();

      for (const file of filesToProcess) {
        const modulePath = join(generatedDir, file);
        console.log(`[PluginLoader] Hot-load attempt: ${file}`);

        try {
          // Cache-bust: append timestamp query to force fresh import
          const mod = await import(`${modulePath}?t=${Date.now()}`);
          const plugin: ResourcePlugin | undefined = mod.default ?? mod.plugin;

          if (!plugin || typeof plugin.category !== 'string') {
            console.warn(`[PluginLoader] Hot-load skipped ${file}: no valid plugin export`);
            continue;
          }

          console.log(`[PluginLoader] Hot-loaded plugin: ${plugin.category} (${plugin.displayName})`);
          onNewPlugin(plugin);
        } catch (err) {
          console.error(`[PluginLoader] Hot-load failed for ${file}:`, err);
        }
      }
    }, WATCH_DEBOUNCE_MS);
  });

  console.log(`[PluginLoader] Watching ${generatedDir} for new plugins`);
}
