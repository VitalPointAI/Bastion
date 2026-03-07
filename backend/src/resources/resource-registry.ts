/**
 * Resource Registry — Singleton with DB-backed write-through cache
 *
 * Phase 27 Plan 03: Central access point for all resource operations.
 * Follows the AgentRegistry singleton pattern. Provides 4 query types:
 * by DID, by capability, by type+status, and by geographic area.
 * Auto-migrates existing resources to get DIDs on first initialization.
 */

import type {
  RegisteredResource,
  Resource,
  ResourceCategory,
  ResourceManifest,
  ResourceStatus,
  ResourceTrustTier,
} from './types.js';
import { resourceStore } from './resource-store.js';
import { createResourceDID } from './resource-did.js';
import { getPluginRegistry } from './plugins/plugin-registry.js';

/**
 * ResourceRegistry — singleton managing resource lifecycle, caching, and queries.
 *
 * Write-through cache: every mutation writes to DB first, then updates cache.
 * Indexes maintained in-memory for fast DID and capability lookups.
 */
export class ResourceRegistry {
  /** resourceId -> RegisteredResource */
  private cache: Map<string, RegisteredResource> = new Map();

  /** did -> resourceId for fast DID lookup */
  private didIndex: Map<string, string> = new Map();

  /** capability -> set of resourceIds */
  private capabilityIndex: Map<string, Set<string>> = new Map();

  private initialized = false;
  private lastRefresh = 0;
  private readonly REFRESH_INTERVAL = 60_000; // 60 second periodic refresh

  /**
   * Ensure the registry is initialized. Safe to call multiple times.
   */
  async ensureInitialized(): Promise<void> {
    if (this.initialized) return;
    await this.loadFromDB();
    await this.migrateExistingResources();
    this.initialized = true;
    this.lastRefresh = Date.now();
  }

  /**
   * Load all DID-bearing resources from DB into cache and indexes.
   */
  private async loadFromDB(): Promise<void> {
    const resources = await resourceStore.listResources({});
    this.cache.clear();
    this.didIndex.clear();
    this.capabilityIndex.clear();

    for (const resource of resources) {
      if (resource.did && resource.blindedKey && resource.publicKey) {
        const registered = this.toRegisteredResource(resource);
        this.addToCache(registered);
      }
    }

    console.log(`[ResourceRegistry] Loaded ${this.cache.size} registered resources from DB`);
  }

  /**
   * Migrate existing resources that lack DIDs.
   * Generates DID, keys, and default capabilities from plugin.
   */
  private async migrateExistingResources(): Promise<void> {
    const allResources = await resourceStore.listResources({});
    const unregistered = allResources.filter((r) => !r.did);

    if (unregistered.length === 0) return;

    const pluginRegistry = getPluginRegistry();
    await pluginRegistry.ensureInitialized();

    let count = 0;
    for (const resource of unregistered) {
      const { did, blindedKey, publicKey } = await createResourceDID(resource.id);

      // Get default capabilities from plugin if resource has none
      let capabilities = resource.capabilities;
      if (!capabilities || capabilities.length === 0) {
        capabilities = pluginRegistry.getCapabilities(resource.category);
      }

      await resourceStore.updateResource(resource.id, {
        capabilities,
      });

      // Update DID fields directly via DB since updateResource doesn't handle DID fields
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      await pool.query(
        'UPDATE resources SET did = $1, blinded_key = $2, public_key = $3 WHERE id = $4',
        [did, blindedKey, publicKey, resource.id]
      );

      const registered: RegisteredResource = {
        ...resource,
        did,
        blindedKey,
        publicKey,
        capabilities,
        isAutonomous: resource.isAutonomous ?? false,
        trustTier: resource.isAutonomous ? 'autonomous' : 'observer',
      };

      this.addToCache(registered);
      count++;
    }

    console.log(`[ResourceRegistry] Migrated ${count} existing resources with DIDs`);
  }

  /**
   * Rebuild didIndex and capabilityIndex from cache.
   */
  private rebuildIndexes(): void {
    this.didIndex.clear();
    this.capabilityIndex.clear();

    for (const resource of this.cache.values()) {
      this.didIndex.set(resource.did, resource.id);
      for (const cap of resource.capabilities) {
        let set = this.capabilityIndex.get(cap);
        if (!set) {
          set = new Set();
          this.capabilityIndex.set(cap, set);
        }
        set.add(resource.id);
      }
    }
  }

  /**
   * Refresh cache from DB if stale (older than REFRESH_INTERVAL).
   */
  private async refreshIfStale(): Promise<void> {
    if (Date.now() - this.lastRefresh > this.REFRESH_INTERVAL) {
      await this.loadFromDB();
      this.lastRefresh = Date.now();
    }
  }

  /**
   * Add a registered resource to cache and indexes.
   */
  private addToCache(resource: RegisteredResource): void {
    this.cache.set(resource.id, resource);
    this.didIndex.set(resource.did, resource.id);
    for (const cap of resource.capabilities) {
      let set = this.capabilityIndex.get(cap);
      if (!set) {
        set = new Set();
        this.capabilityIndex.set(cap, set);
      }
      set.add(resource.id);
    }
  }

  /**
   * Remove a resource from cache and indexes.
   */
  private removeFromCache(id: string): void {
    const resource = this.cache.get(id);
    if (!resource) return;

    this.didIndex.delete(resource.did);
    for (const cap of resource.capabilities) {
      const set = this.capabilityIndex.get(cap);
      if (set) {
        set.delete(id);
        if (set.size === 0) {
          this.capabilityIndex.delete(cap);
        }
      }
    }
    this.cache.delete(id);
  }

  /**
   * Convert a Resource with DID fields to a RegisteredResource.
   */
  private toRegisteredResource(resource: Resource): RegisteredResource {
    const trustTier: ResourceTrustTier = resource.isAutonomous ? 'autonomous' : 'observer';
    return {
      ...resource,
      did: resource.did!,
      blindedKey: resource.blindedKey!,
      publicKey: resource.publicKey!,
      trustTier,
    };
  }

  // ─── Registration ──────────────────────────────────────────────

  /**
   * Register a new resource: validate via plugin, create in DB, generate DID.
   */
  async registerResource(manifest: ResourceManifest): Promise<RegisteredResource> {
    await this.ensureInitialized();
    await this.refreshIfStale();

    const pluginRegistry = getPluginRegistry();
    await pluginRegistry.ensureInitialized();

    // Validate specifications via plugin if available
    const plugin = pluginRegistry.getPlugin(manifest.category);
    if (plugin) {
      const result = plugin.validateSpecifications(manifest.specifications);
      if (!result.success) {
        throw new Error(
          `Invalid specifications for ${manifest.category}: ${result.error.message}`
        );
      }
    }

    // Create resource in DB
    const resource = await resourceStore.createResource(
      manifest.missionId,
      manifest.name,
      manifest.category,
      'FMC', // New resources default to Fully Mission Capable
      manifest.specifications,
      undefined, // serialNumber
      undefined, // sidc
      undefined, // location
      undefined, // did — set after creation
      undefined, // blindedKey
      undefined, // publicKey
      manifest.isAutonomous,
      manifest.capabilities
    );

    // Generate DID
    const { did, blindedKey, publicKey } = await createResourceDID(resource.id);

    // Update resource in DB with DID and keys
    const { getPool } = await import('../lib/database.js');
    const pool = getPool();
    await pool.query(
      'UPDATE resources SET did = $1, blinded_key = $2, public_key = $3 WHERE id = $4',
      [did, blindedKey, publicKey, resource.id]
    );

    // Determine trust tier
    const trustTier: ResourceTrustTier = manifest.isAutonomous ? 'autonomous' : 'observer';

    const registered: RegisteredResource = {
      ...resource,
      did,
      blindedKey,
      publicKey,
      trustTier,
    };

    this.addToCache(registered);
    return registered;
  }

  // ─── 4 Query Types ─────────────────────────────────────────────

  /**
   * Query 1: Get resource by DID (O(1) lookup via index).
   */
  getByDID(did: string): RegisteredResource | undefined {
    const id = this.didIndex.get(did);
    if (!id) return undefined;
    return this.cache.get(id);
  }

  /**
   * Query 2: Find resources by capability tag.
   */
  findByCapability(capability: string): RegisteredResource[] {
    const ids = this.capabilityIndex.get(capability);
    if (!ids) return [];
    const results: RegisteredResource[] = [];
    for (const id of ids) {
      const resource = this.cache.get(id);
      if (resource) results.push(resource);
    }
    return results;
  }

  /**
   * Query 3: Find resources by type (category) and/or status.
   */
  findByTypeAndStatus(category?: ResourceCategory, status?: ResourceStatus): RegisteredResource[] {
    const results: RegisteredResource[] = [];
    for (const resource of this.cache.values()) {
      if (category && resource.category !== category) continue;
      if (status && resource.status !== status) continue;
      results.push(resource);
    }
    return results;
  }

  /**
   * Query 4: Find resources within a geographic bounding box.
   */
  findInArea(bounds: { north: number; south: number; east: number; west: number }): RegisteredResource[] {
    const results: RegisteredResource[] = [];
    for (const resource of this.cache.values()) {
      if (!resource.location) continue;
      const { lat, lng } = resource.location;
      if (
        lat >= bounds.south &&
        lat <= bounds.north &&
        lng >= bounds.west &&
        lng <= bounds.east
      ) {
        results.push(resource);
      }
    }
    return results;
  }

  // ─── Other Methods ─────────────────────────────────────────────

  /**
   * Get a resource by ID from cache.
   */
  getResource(id: string): RegisteredResource | undefined {
    return this.cache.get(id);
  }

  /**
   * Get all registered resources.
   */
  getAllResources(): RegisteredResource[] {
    return Array.from(this.cache.values());
  }

  /**
   * Get resources filtered by mission ID.
   */
  getResourcesByMission(missionId: string): RegisteredResource[] {
    const results: RegisteredResource[] = [];
    for (const resource of this.cache.values()) {
      if (resource.missionId === missionId) {
        results.push(resource);
      }
    }
    return results;
  }

  /**
   * Update a resource's status. Write-through: DB first, then cache.
   */
  async updateResourceStatus(id: string, status: ResourceStatus): Promise<RegisteredResource | null> {
    await this.ensureInitialized();

    const updated = await resourceStore.updateStatus(id, status);
    if (!updated) return null;

    // Update cache
    const cached = this.cache.get(id);
    if (cached) {
      const refreshed: RegisteredResource = { ...cached, status, updatedAt: updated.updatedAt };
      this.cache.set(id, refreshed);
      return refreshed;
    }

    return null;
  }

  /**
   * Remove a resource. Write-through: DB first, then cache + indexes.
   */
  async removeResource(id: string): Promise<boolean> {
    await this.ensureInitialized();

    const deleted = await resourceStore.deleteResource(id);
    if (!deleted) return false;

    this.removeFromCache(id);
    return true;
  }

  /**
   * Invalidate the entire cache, forcing reload on next access.
   */
  invalidateCache(): void {
    this.cache.clear();
    this.didIndex.clear();
    this.capabilityIndex.clear();
    this.initialized = false;
    this.lastRefresh = 0;
  }
}

// ─── Singleton ─────────────────────────────────────────────────

let registryInstance: ResourceRegistry | null = null;

/**
 * Get the singleton ResourceRegistry instance.
 * Call ensureInitialized() before first use.
 */
export function getResourceRegistry(): ResourceRegistry {
  if (!registryInstance) {
    registryInstance = new ResourceRegistry();
  }
  return registryInstance;
}
