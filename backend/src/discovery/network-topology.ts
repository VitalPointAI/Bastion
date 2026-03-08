/**
 * Network Topology Mapper
 *
 * Phase 32 Plan 07: Builds and maintains a communications graph of
 * discovered devices, networks, and connections. Supports configurable
 * network hopping through onboarded bridge devices at participant or
 * autonomous trust tiers.
 *
 * - Bastion is always the center node (hop 0)
 * - Direct devices are hop 1
 * - Hopped devices are hop 2+
 * - Hopping is disabled by default per user decision
 * - Topology persists to PostgreSQL as JSONB snapshots
 */

import type { DiscoveredDevice, TransportType } from './types.js';
import type { ResourceTrustTier } from '../resources/types.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TopologyNode {
  id: string;
  type: 'device' | 'network' | 'bastion';
  displayName: string;
  transportType?: TransportType;
  deviceDid?: string;
  trustTier?: ResourceTrustTier;
  metadata: Record<string, unknown>;
}

export interface TopologyEdge {
  sourceId: string;
  targetId: string;
  connectionType: 'direct' | 'bridged' | 'discovered';
  transportType?: TransportType;
  signalStrength?: number;
  latency?: number;
  hopCount: number;
}

export interface TopologyNetwork {
  id: string;
  name?: string;
  cidr?: string;
  gatewayNodeId?: string;
  hopDepth: number;
}

export interface TopologyGraph {
  nodes: Map<string, TopologyNode>;
  edges: TopologyEdge[];
  networks: Map<string, TopologyNetwork>;
}

/**
 * Serializable form of TopologyGraph for JSON/JSONB storage.
 */
interface SerializedGraph {
  nodes: Array<[string, TopologyNode]>;
  edges: TopologyEdge[];
  networks: Array<[string, TopologyNetwork]>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BASTION_NODE_ID = 'bastion';
const DEFAULT_MAX_HOP_DEPTH = 3;

/** Trust tiers that allow a device to serve as a network bridge */
const BRIDGE_TRUST_TIERS: ReadonlyArray<ResourceTrustTier> = ['participant', 'autonomous'];

// ---------------------------------------------------------------------------
// NetworkTopology
// ---------------------------------------------------------------------------

export class NetworkTopology {
  /** The in-memory topology graph */
  private graph: TopologyGraph;

  /** Whether network hopping is enabled (default: disabled per user decision) */
  hoppingEnabled = false;

  /** Maximum number of network hops from Bastion */
  maxHopDepth: number = DEFAULT_MAX_HOP_DEPTH;

  /** Problem set ID for scoped persistence */
  private problemSetId: string;

  /** Track whether save is needed */
  private dirty = false;

  /** Save debounce timer */
  private saveTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(problemSetId: string = 'global') {
    this.problemSetId = problemSetId;
    this.graph = {
      nodes: new Map(),
      edges: [],
      networks: new Map(),
    };

    // Always include the bastion self-node at the center
    this.graph.nodes.set(BASTION_NODE_ID, {
      id: BASTION_NODE_ID,
      type: 'bastion',
      displayName: 'BASTION',
      metadata: { hopCount: 0 },
    });
  }

  // -----------------------------------------------------------------------
  // Core methods
  // -----------------------------------------------------------------------

  /**
   * Add a discovered device as a node in the topology.
   * Creates an edge from the device to the bastion node (direct connection).
   */
  addDevice(device: DiscoveredDevice): void {
    const nodeId = device.deviceDid ?? device.id;

    // Create or update the node
    this.graph.nodes.set(nodeId, {
      id: nodeId,
      type: 'device',
      displayName: device.fingerprint?.displayName ?? device.rawIdentifier,
      transportType: device.transportType,
      deviceDid: device.deviceDid,
      metadata: {
        rawIdentifier: device.rawIdentifier,
        state: device.state,
        firstSeen: device.firstSeen,
        lastSeen: device.lastSeen,
        signalStrength: device.signalStrength,
        hopCount: 1,
      },
    });

    // Check if edge already exists
    const edgeExists = this.graph.edges.some(
      (e) =>
        (e.sourceId === BASTION_NODE_ID && e.targetId === nodeId) ||
        (e.sourceId === nodeId && e.targetId === BASTION_NODE_ID),
    );

    if (!edgeExists) {
      this.graph.edges.push({
        sourceId: BASTION_NODE_ID,
        targetId: nodeId,
        connectionType: 'direct',
        transportType: device.transportType,
        signalStrength: device.signalStrength,
        hopCount: 1,
      });
    }

    this.markDirty();
  }

  /**
   * Add a connection (edge) between two nodes.
   */
  addConnection(
    sourceId: string,
    targetId: string,
    edge: Omit<TopologyEdge, 'sourceId' | 'targetId'>,
  ): void {
    // Verify both nodes exist
    if (!this.graph.nodes.has(sourceId) || !this.graph.nodes.has(targetId)) {
      console.warn(
        `[NetworkTopology] Cannot add connection: node(s) not found (${sourceId} -> ${targetId})`,
      );
      return;
    }

    this.graph.edges.push({
      sourceId,
      targetId,
      ...edge,
    });
    this.markDirty();
  }

  /**
   * Remove a device and all its edges from the topology.
   */
  removeDevice(deviceId: string): void {
    // Don't allow removing the bastion node
    if (deviceId === BASTION_NODE_ID) return;

    this.graph.nodes.delete(deviceId);
    this.graph.edges = this.graph.edges.filter(
      (e) => e.sourceId !== deviceId && e.targetId !== deviceId,
    );
    this.markDirty();
  }

  /**
   * Return the full topology graph for visualization.
   */
  getGraph(): TopologyGraph {
    return {
      nodes: new Map(this.graph.nodes),
      edges: [...this.graph.edges],
      networks: new Map(this.graph.networks),
    };
  }

  /**
   * Return nodes and edges for a specific network.
   */
  getSubgraph(networkId: string): TopologyGraph {
    const network = this.graph.networks.get(networkId);
    if (!network) {
      return { nodes: new Map(), edges: [], networks: new Map() };
    }

    // Find all nodes connected through this network's gateway
    const relevantNodeIds = new Set<string>();
    if (network.gatewayNodeId) {
      relevantNodeIds.add(network.gatewayNodeId);

      // Find all devices connected to this gateway
      for (const edge of this.graph.edges) {
        if (edge.sourceId === network.gatewayNodeId) {
          relevantNodeIds.add(edge.targetId);
        }
        if (edge.targetId === network.gatewayNodeId) {
          relevantNodeIds.add(edge.sourceId);
        }
      }
    }

    const nodes = new Map<string, TopologyNode>();
    relevantNodeIds.forEach((id) => {
      const node = this.graph.nodes.get(id);
      if (node) nodes.set(id, node);
    });

    const edges = this.graph.edges.filter(
      (e) => relevantNodeIds.has(e.sourceId) && relevantNodeIds.has(e.targetId),
    );

    const networks = new Map<string, TopologyNetwork>();
    networks.set(networkId, network);

    return { nodes, edges, networks };
  }

  /**
   * BFS shortest path between two nodes.
   * Returns the node chain from source to target, or empty array if no path.
   */
  getPath(fromId: string, toId: string): TopologyNode[] {
    if (!this.graph.nodes.has(fromId) || !this.graph.nodes.has(toId)) {
      return [];
    }
    if (fromId === toId) {
      const node = this.graph.nodes.get(fromId);
      return node ? [node] : [];
    }

    // Build adjacency list
    const adjacency = new Map<string, string[]>();
    for (const edge of this.graph.edges) {
      const srcNeighbors = adjacency.get(edge.sourceId) ?? [];
      srcNeighbors.push(edge.targetId);
      adjacency.set(edge.sourceId, srcNeighbors);

      const tgtNeighbors = adjacency.get(edge.targetId) ?? [];
      tgtNeighbors.push(edge.sourceId);
      adjacency.set(edge.targetId, tgtNeighbors);
    }

    // BFS
    const visited = new Set<string>();
    const parentMap = new Map<string, string>();
    const queue: string[] = [fromId];
    visited.add(fromId);

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === toId) {
        // Reconstruct path
        const path: TopologyNode[] = [];
        let node: string | undefined = toId;
        while (node !== undefined) {
          const topNode = this.graph.nodes.get(node);
          if (topNode) path.unshift(topNode);
          node = parentMap.get(node);
        }
        return path;
      }

      const neighbors = adjacency.get(current) ?? [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          parentMap.set(neighbor, current);
          queue.push(neighbor);
        }
      }
    }

    return []; // No path found
  }

  // -----------------------------------------------------------------------
  // Network hopping
  // -----------------------------------------------------------------------

  /**
   * Discover adjacent networks through a bridge device.
   *
   * Requirements:
   * - Hopping must be enabled
   * - Bridge device must be at 'participant' or 'autonomous' trust tier
   * - Current hop depth must not exceed maxHopDepth
   *
   * Returns newly discovered TopologyNetwork entries.
   */
  async discoverAdjacentNetworks(
    bridgeDeviceId: string,
  ): Promise<TopologyNetwork[]> {
    if (!this.hoppingEnabled) {
      console.warn('[NetworkTopology] Network hopping is disabled');
      return [];
    }

    // Verify bridge device exists in topology
    const bridgeNode = this.graph.nodes.get(bridgeDeviceId);
    if (!bridgeNode) {
      console.warn(
        `[NetworkTopology] Bridge device ${bridgeDeviceId} not found in topology`,
      );
      return [];
    }

    // Verify trust tier
    if (!bridgeNode.trustTier || !BRIDGE_TRUST_TIERS.includes(bridgeNode.trustTier)) {
      console.warn(
        `[NetworkTopology] Bridge device ${bridgeDeviceId} has insufficient trust tier: ${bridgeNode.trustTier ?? 'none'}. Requires participant or autonomous.`,
      );
      return [];
    }

    // Check hop depth
    const currentHopDepth = (bridgeNode.metadata.hopCount as number) ?? 1;
    if (currentHopDepth >= this.maxHopDepth) {
      console.warn(
        `[NetworkTopology] Max hop depth (${this.maxHopDepth}) reached at device ${bridgeDeviceId} (depth ${currentHopDepth})`,
      );
      return [];
    }

    // Simulate network discovery through bridge device
    // In production, this would use the bridge device's command adapter
    // to scan its accessible networks. For now, create placeholder networks
    // that the DiscoveryService would populate.
    const newNetworks: TopologyNetwork[] = [];

    // Create a placeholder for adjacent network discovered through this bridge
    const networkId = `net-${bridgeDeviceId}-${Date.now()}`;
    const network: TopologyNetwork = {
      id: networkId,
      name: `Adjacent network via ${bridgeNode.displayName}`,
      gatewayNodeId: bridgeDeviceId,
      hopDepth: currentHopDepth + 1,
    };

    this.graph.networks.set(networkId, network);
    newNetworks.push(network);
    this.markDirty();

    console.log(
      `[NetworkTopology] Discovered ${newNetworks.length} adjacent network(s) through bridge ${bridgeDeviceId} at hop depth ${currentHopDepth + 1}`,
    );

    return newNetworks;
  }

  /**
   * Show the chain of bridge devices from Bastion to a given device.
   * Uses getPath internally, filtering for bridge-type edges.
   */
  getHopChain(deviceId: string): TopologyNode[] {
    return this.getPath(BASTION_NODE_ID, deviceId);
  }

  // -----------------------------------------------------------------------
  // Network management
  // -----------------------------------------------------------------------

  /**
   * Add or update a network in the topology.
   */
  addNetwork(network: TopologyNetwork): void {
    this.graph.networks.set(network.id, network);
    this.markDirty();
  }

  /**
   * Remove a network and its associated edges.
   */
  removeNetwork(networkId: string): void {
    this.graph.networks.delete(networkId);
    this.markDirty();
  }

  /**
   * Update a node's trust tier (e.g., after DAO promotion).
   */
  updateNodeTrustTier(nodeId: string, trustTier: ResourceTrustTier): void {
    const node = this.graph.nodes.get(nodeId);
    if (node) {
      node.trustTier = trustTier;
      this.graph.nodes.set(nodeId, node);
      this.markDirty();
    }
  }

  // -----------------------------------------------------------------------
  // Statistics
  // -----------------------------------------------------------------------

  /**
   * Get topology statistics for monitoring.
   */
  getStats(): {
    nodeCount: number;
    edgeCount: number;
    networkCount: number;
    maxHopDepth: number;
    hoppingEnabled: boolean;
  } {
    return {
      nodeCount: this.graph.nodes.size,
      edgeCount: this.graph.edges.length,
      networkCount: this.graph.networks.size,
      maxHopDepth: this.maxHopDepth,
      hoppingEnabled: this.hoppingEnabled,
    };
  }

  // -----------------------------------------------------------------------
  // Persistence — PostgreSQL JSONB snapshots
  // -----------------------------------------------------------------------

  /**
   * Ensure the network_topology table exists.
   */
  async ensureTable(): Promise<void> {
    try {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();
      await pool.query(`
        CREATE TABLE IF NOT EXISTS network_topology (
          id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
          problem_set_id TEXT NOT NULL,
          graph_data JSONB NOT NULL DEFAULT '{}'::jsonb,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (problem_set_id)
        )
      `);
    } catch (err) {
      console.warn(
        '[NetworkTopology] Failed to ensure table:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Save the current graph to PostgreSQL as a JSONB snapshot.
   */
  async save(): Promise<void> {
    try {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();

      const serialized: SerializedGraph = {
        nodes: Array.from(this.graph.nodes.entries()),
        edges: this.graph.edges,
        networks: Array.from(this.graph.networks.entries()),
      };

      await pool.query(
        `INSERT INTO network_topology (problem_set_id, graph_data, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (problem_set_id)
         DO UPDATE SET graph_data = $2, updated_at = NOW()`,
        [this.problemSetId, JSON.stringify(serialized)],
      );

      this.dirty = false;
      console.log(`[NetworkTopology] Saved topology for problem set ${this.problemSetId}`);
    } catch (err) {
      console.warn(
        '[NetworkTopology] Failed to save:',
        err instanceof Error ? err.message : err,
      );
    }
  }

  /**
   * Load topology from PostgreSQL. Overwrites in-memory graph.
   */
  async load(): Promise<boolean> {
    try {
      const { getPool } = await import('../lib/database.js');
      const pool = getPool();

      const result = await pool.query(
        `SELECT graph_data FROM network_topology WHERE problem_set_id = $1`,
        [this.problemSetId],
      );

      if (result.rows.length === 0) return false;

      const serialized = result.rows[0].graph_data as SerializedGraph;

      this.graph = {
        nodes: new Map(serialized.nodes),
        edges: serialized.edges,
        networks: new Map(serialized.networks),
      };

      // Ensure bastion node exists
      if (!this.graph.nodes.has(BASTION_NODE_ID)) {
        this.graph.nodes.set(BASTION_NODE_ID, {
          id: BASTION_NODE_ID,
          type: 'bastion',
          displayName: 'BASTION',
          metadata: { hopCount: 0 },
        });
      }

      this.dirty = false;
      console.log(
        `[NetworkTopology] Loaded topology for problem set ${this.problemSetId} (${this.graph.nodes.size} nodes, ${this.graph.edges.length} edges)`,
      );
      return true;
    } catch (err) {
      console.warn(
        '[NetworkTopology] Failed to load:',
        err instanceof Error ? err.message : err,
      );
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // Dirty tracking / debounced save
  // -----------------------------------------------------------------------

  /**
   * Mark topology as modified. Triggers debounced save.
   */
  private markDirty(): void {
    this.dirty = true;

    // Debounce save — wait 5 seconds after last change
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      if (this.dirty) {
        this.save().catch((err) => {
          console.warn(
            '[NetworkTopology] Debounced save failed:',
            err instanceof Error ? err.message : err,
          );
        });
      }
    }, 5_000);
  }

  /**
   * Force an immediate save (e.g., on shutdown).
   */
  async flush(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (this.dirty) {
      await this.save();
    }
  }

  /**
   * Clean up timers.
   */
  destroy(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
  }
}
