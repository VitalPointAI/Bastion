/**
 * Plugin Registry — Singleton mapping category to plugin instance
 *
 * Phase 27 Plan 02: Follows the established AgentRegistry singleton pattern.
 * Two-phase init: loadPlugins() gets pure definitions, no side effects during load.
 */

import type { AnyStateMachine } from 'xstate';
import type { ResourcePlugin, SafeParseResult } from './base-plugin.js';
import { loadPlugins } from './plugin-loader.js';

/**
 * Singleton registry providing lookup of ResourcePlugin instances by category.
 *
 * Usage:
 *   const registry = getPluginRegistry();
 *   await registry.ensureInitialized();
 *   const vehiclePlugin = registry.getPlugin('vehicles');
 */
export class PluginRegistry {
  private plugins: Map<string, ResourcePlugin> = new Map();
  private initialized = false;

  /**
   * Initialize the registry by loading all plugins from disk.
   * Safe to call multiple times — only loads once.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    this.plugins = await loadPlugins();
    this.initialized = true;
    console.log(`[PluginRegistry] Initialized with ${this.plugins.size} plugins:`,
      Array.from(this.plugins.keys()).join(', ')
    );
  }

  /**
   * Get plugin for a specific resource category.
   */
  getPlugin(category: string): ResourcePlugin | undefined {
    return this.plugins.get(category);
  }

  /**
   * Get all registered plugins.
   */
  getAllPlugins(): ResourcePlugin[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get all registered category names.
   */
  getCategories(): string[] {
    return Array.from(this.plugins.keys());
  }

  /**
   * Validate specifications for a given category using the category's plugin.
   * Returns undefined if category has no registered plugin.
   */
  validateSpecifications(category: string, specs: unknown): SafeParseResult<unknown> | undefined {
    const plugin = this.plugins.get(category);
    if (!plugin) return undefined;
    return plugin.validateSpecifications(specs);
  }

  /**
   * Get the state machine for a given category.
   * Returns undefined if category has no registered plugin.
   */
  getStateMachine(category: string): AnyStateMachine | undefined {
    const plugin = this.plugins.get(category);
    return plugin?.stateMachine;
  }

  /**
   * Get capability tags for a given category.
   * Returns empty array if category has no registered plugin.
   */
  getCapabilities(category: string): string[] {
    const plugin = this.plugins.get(category);
    return plugin?.capabilities ?? [];
  }
}

/** Singleton instance */
let instance: PluginRegistry | undefined;

/**
 * Get the singleton PluginRegistry instance.
 * Call ensureInitialized() before first use.
 */
export function getPluginRegistry(): PluginRegistry {
  if (!instance) {
    instance = new PluginRegistry();
  }
  return instance;
}
