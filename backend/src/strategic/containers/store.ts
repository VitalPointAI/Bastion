/**
 * Container Store
 * PostgreSQL storage for strategic environments, actor categories,
 * containers, document assignments, and agent assignments.
 */

import { getPool } from '../../lib/database.js';
import { randomUUID } from 'crypto';
import type {
  StrategicEnvironment,
  StrategicContainer,
  ContainerAgentAssignment,
  CategoryGroup,
  ContainerSuggestion,
} from './types.js';
import { DEFAULT_ACTOR_CATEGORIES } from './types.js';
import { createProvider } from '../../strategic/extraction/providers/index.js';
import type { ProviderConfig } from '../../strategic/extraction/providers/types.js';
import { configService } from '../../strategic/config/service.js';
import { graphBuilder } from '../../graph/construction/graph-builder.js';
import { objectiveStore } from '../../strategic/objectives/store.js';

// =============================================================================
// Table Initialization
// =============================================================================

/**
 * Create all container-related tables if they do not exist.
 * Called lazily on first API request.
 */
export async function initContainerTables(): Promise<void> {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS strategic_environments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS actor_categories (
      id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL REFERENCES strategic_environments(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      display_order INTEGER NOT NULL DEFAULT 0,
      is_default BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(environment_id, name)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_actor_categories_environment
    ON actor_categories(environment_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS strategic_containers (
      id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL REFERENCES strategic_environments(id) ON DELETE CASCADE,
      category_id TEXT NOT NULL REFERENCES actor_categories(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      created_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_strategic_containers_environment
    ON strategic_containers(environment_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS container_documents (
      id TEXT PRIMARY KEY,
      container_id TEXT NOT NULL REFERENCES strategic_containers(id) ON DELETE CASCADE,
      document_id TEXT NOT NULL,
      assigned_by TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(container_id, document_id)
    )
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_container_documents_container
    ON container_documents(container_id)
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS container_agent_assignments (
      id TEXT PRIMARY KEY,
      container_id TEXT NOT NULL REFERENCES strategic_containers(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      assignment_type TEXT NOT NULL DEFAULT 'monitor',
      auto_process_new BOOLEAN NOT NULL DEFAULT true,
      assigned_by TEXT NOT NULL,
      assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(container_id, agent_id)
    )
  `);

  // Problem set to environment mapping (lightweight, Phase 26 formalizes)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS problem_set_environments (
      problem_set_id TEXT PRIMARY KEY,
      environment_id TEXT NOT NULL REFERENCES strategic_environments(id)
    )
  `);

  console.log('+ container tables initialized');
}

// =============================================================================
// ContainerStore Class
// =============================================================================

export class ContainerStore {

  // ---------------------------------------------------------------------------
  // Environments
  // ---------------------------------------------------------------------------

  /**
   * Create a strategic environment and seed default actor categories.
   */
  async createEnvironment(
    name: string,
    description: string | undefined,
    createdBy: string
  ): Promise<string> {
    const pool = getPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO strategic_environments (id, name, description, created_by)
       VALUES ($1, $2, $3, $4)`,
      [id, name, description || null, createdBy]
    );

    // Seed default actor categories
    for (const [, meta] of Object.entries(DEFAULT_ACTOR_CATEGORIES)) {
      await pool.query(
        `INSERT INTO actor_categories (id, environment_id, name, color, display_order, is_default)
         VALUES ($1, $2, $3, $4, $5, true)`,
        [randomUUID(), id, meta.name, meta.color, meta.display_order]
      );
    }

    return id;
  }

  /**
   * Get a single environment by ID.
   */
  async getEnvironment(id: string): Promise<StrategicEnvironment | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT * FROM strategic_environments WHERE id = $1`,
      [id]
    );
    if (result.rows.length === 0) return null;
    return this.mapEnvironment(result.rows[0]);
  }

  /**
   * Get or auto-create environment for a problem set.
   * Uses problem_set_environments mapping table.
   */
  async getEnvironmentByProblemSet(
    problemSetId: string,
    createdBy: string = 'system'
  ): Promise<StrategicEnvironment> {
    const pool = getPool();

    // Check existing mapping
    const mapping = await pool.query(
      `SELECT environment_id FROM problem_set_environments WHERE problem_set_id = $1`,
      [problemSetId]
    );

    if (mapping.rows.length > 0) {
      const env = await this.getEnvironment(mapping.rows[0].environment_id);
      if (env) return env;
    }

    // Auto-create environment for this problem set
    const envId = await this.createEnvironment(
      `Environment for ${problemSetId}`,
      undefined,
      createdBy
    );

    await pool.query(
      `INSERT INTO problem_set_environments (problem_set_id, environment_id)
       VALUES ($1, $2)
       ON CONFLICT (problem_set_id) DO NOTHING`,
      [problemSetId, envId]
    );

    const env = await this.getEnvironment(envId);
    return env!;
  }

  // ---------------------------------------------------------------------------
  // Categories
  // ---------------------------------------------------------------------------

  /**
   * Get containers grouped by category for an environment.
   * Single aggregate query to avoid N+1.
   */
  async getContainersGroupedByCategory(environmentId: string): Promise<CategoryGroup[]> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT
        ac.id as category_id,
        ac.environment_id as category_environment_id,
        ac.name as category_name,
        ac.color as category_color,
        ac.display_order,
        ac.is_default,
        ac.created_at as category_created_at,
        sc.id as container_id,
        sc.environment_id as container_environment_id,
        sc.category_id as container_category_id,
        sc.name as container_name,
        sc.description as container_description,
        sc.created_by as container_created_by,
        sc.created_at as container_created_at,
        sc.updated_at as container_updated_at,
        COUNT(DISTINCT cd.id)::int as document_count,
        COUNT(DISTINCT caa.id)::int as agent_count
      FROM actor_categories ac
      LEFT JOIN strategic_containers sc ON sc.category_id = ac.id
      LEFT JOIN container_documents cd ON cd.container_id = sc.id
      LEFT JOIN container_agent_assignments caa ON caa.container_id = sc.id
      WHERE ac.environment_id = $1
      GROUP BY ac.id, ac.environment_id, ac.name, ac.color, ac.display_order,
               ac.is_default, ac.created_at,
               sc.id, sc.environment_id, sc.category_id, sc.name, sc.description,
               sc.created_by, sc.created_at, sc.updated_at
      ORDER BY ac.display_order, sc.name
    `, [environmentId]);

    return this.groupByCategory(result.rows);
  }

  /**
   * Create a new actor category.
   */
  async createCategory(
    environmentId: string,
    name: string,
    color: string,
    displayOrder?: number
  ): Promise<string> {
    const pool = getPool();
    const id = randomUUID();

    // If no display_order given, place after existing categories
    let order = displayOrder;
    if (order === undefined) {
      const maxResult = await pool.query(
        `SELECT COALESCE(MAX(display_order), -1) + 1 as next_order
         FROM actor_categories WHERE environment_id = $1`,
        [environmentId]
      );
      order = maxResult.rows[0].next_order;
    }

    await pool.query(
      `INSERT INTO actor_categories (id, environment_id, name, color, display_order)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, environmentId, name, color, order]
    );

    return id;
  }

  /**
   * Update a category's name or color. Writes audit event on change.
   */
  async updateCategory(
    categoryId: string,
    updates: { name?: string; color?: string }
  ): Promise<void> {
    const pool = getPool();

    // Get current state for audit
    const current = await pool.query(
      `SELECT * FROM actor_categories WHERE id = $1`,
      [categoryId]
    );
    if (current.rows.length === 0) {
      throw new Error('Category not found');
    }

    const setClauses: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(updates.name);
    }
    if (updates.color !== undefined) {
      setClauses.push(`color = $${paramIdx++}`);
      params.push(updates.color);
    }

    if (setClauses.length === 0) return;

    params.push(categoryId);
    await pool.query(
      `UPDATE actor_categories SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    // Write audit event
    await pool.query(
      `INSERT INTO blockchain_events (event_type, aggregate_id, event_data, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        'container_category_changed',
        categoryId,
        JSON.stringify({
          previous: { name: current.rows[0].name, color: current.rows[0].color },
          updated: updates,
        }),
      ]
    );
  }

  /**
   * Delete a category. Only succeeds if no containers reference it.
   */
  async deleteCategory(categoryId: string): Promise<boolean> {
    const pool = getPool();

    // Check for containers
    const containers = await pool.query(
      `SELECT COUNT(*)::int as cnt FROM strategic_containers WHERE category_id = $1`,
      [categoryId]
    );

    if (containers.rows[0].cnt > 0) {
      return false;
    }

    const result = await pool.query(
      `DELETE FROM actor_categories WHERE id = $1 AND is_default = false`,
      [categoryId]
    );

    return (result.rowCount ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Containers
  // ---------------------------------------------------------------------------

  /**
   * Create a new container.
   */
  async createContainer(
    environmentId: string,
    categoryId: string,
    name: string,
    description: string | undefined,
    createdBy: string
  ): Promise<string> {
    const pool = getPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO strategic_containers (id, environment_id, category_id, name, description, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, environmentId, categoryId, name, description || null, createdBy]
    );

    return id;
  }

  /**
   * Update a container's name, description, or category.
   * If category changes, writes audit event.
   */
  async updateContainer(
    containerId: string,
    updates: { name?: string; description?: string; categoryId?: string }
  ): Promise<void> {
    const pool = getPool();

    // Get current state for audit (if category changes)
    let oldCategoryId: string | null = null;
    if (updates.categoryId !== undefined) {
      const current = await pool.query(
        `SELECT category_id FROM strategic_containers WHERE id = $1`,
        [containerId]
      );
      if (current.rows.length > 0) {
        oldCategoryId = current.rows[0].category_id;
      }
    }

    const setClauses: string[] = ['updated_at = NOW()'];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIdx++}`);
      params.push(updates.name);
    }
    if (updates.description !== undefined) {
      setClauses.push(`description = $${paramIdx++}`);
      params.push(updates.description);
    }
    if (updates.categoryId !== undefined) {
      setClauses.push(`category_id = $${paramIdx++}`);
      params.push(updates.categoryId);
    }

    params.push(containerId);
    await pool.query(
      `UPDATE strategic_containers SET ${setClauses.join(', ')} WHERE id = $${paramIdx}`,
      params
    );

    // Write audit event if category changed
    if (updates.categoryId !== undefined && oldCategoryId && oldCategoryId !== updates.categoryId) {
      await pool.query(
        `INSERT INTO blockchain_events (event_type, aggregate_id, event_data, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [
          'container_category_changed',
          containerId,
          JSON.stringify({
            previous_category_id: oldCategoryId,
            new_category_id: updates.categoryId,
          }),
        ]
      );
    }
  }

  /**
   * Delete a container. Returns orphaned document IDs (docs only in this container).
   */
  async deleteContainer(
    containerId: string
  ): Promise<{ deletedContainerId: string; orphanedDocumentIds: string[] }> {
    const pool = getPool();

    // Find documents that would become orphaned
    // (documents only in this container, not in any other)
    const orphaned = await pool.query(`
      SELECT cd.document_id
      FROM container_documents cd
      WHERE cd.container_id = $1
        AND cd.document_id NOT IN (
          SELECT cd2.document_id
          FROM container_documents cd2
          WHERE cd2.container_id != $1
        )
    `, [containerId]);

    const orphanedDocumentIds = orphaned.rows.map(
      (r: Record<string, unknown>) => r.document_id as string
    );

    // Delete the container (CASCADE removes junction entries)
    await pool.query(
      `DELETE FROM strategic_containers WHERE id = $1`,
      [containerId]
    );

    return { deletedContainerId: containerId, orphanedDocumentIds };
  }

  // ---------------------------------------------------------------------------
  // Document Assignments
  // ---------------------------------------------------------------------------

  /**
   * Get documents in a container with full document fields.
   */
  async getContainerDocuments(containerId: string): Promise<Record<string, unknown>[]> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT sd.id, sd.title, sd.level, sd.original_filename, sd.mime_type,
             sd.page_count, sd.text_length, sd.classification, sd.ipfs_cid,
             sd.created_by, sd.workspace_id, sd.created_at,
             COALESCE(COUNT(so.id), 0)::int as objective_count,
             cd.assigned_by, cd.assigned_at as container_assigned_at
      FROM container_documents cd
      JOIN strategic_documents sd ON sd.id = cd.document_id
      LEFT JOIN strategic_objectives so ON so.document_id = sd.id
      WHERE cd.container_id = $1
      GROUP BY sd.id, sd.title, sd.level, sd.original_filename, sd.mime_type,
               sd.page_count, sd.text_length, sd.classification, sd.ipfs_cid,
               sd.created_by, sd.workspace_id, sd.created_at,
               cd.assigned_by, cd.assigned_at
      ORDER BY cd.assigned_at DESC
    `, [containerId]);

    return result.rows;
  }

  /**
   * Assign a document to one or more containers.
   * Uses ON CONFLICT DO NOTHING for idempotency.
   */
  async assignDocumentToContainers(
    documentId: string,
    containerIds: string[],
    assignedBy: string
  ): Promise<void> {
    const pool = getPool();

    for (const containerId of containerIds) {
      await pool.query(
        `INSERT INTO container_documents (id, container_id, document_id, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (container_id, document_id) DO NOTHING`,
        [randomUUID(), containerId, documentId, assignedBy]
      );
    }

    // Auto-trigger RAFT extraction for the document with container scoping
    // Fire-and-forget: don't await, don't block the assignment response
    (async () => {
      try {
        // Derive workspaceId from the container's parent environment
        const containerRow = await pool.query(
          `SELECT se.problem_set_id
           FROM strategic_containers sc
           JOIN problem_set_environments se ON se.environment_id = sc.environment_id
           WHERE sc.id = $1`,
          [containerIds[0]]
        );
        const workspaceId = containerRow.rows[0]?.problem_set_id as string | undefined;

        const objectives = await objectiveStore.getObjectivesForDocument(documentId);
        await graphBuilder.buildFromDocument(
          documentId,
          objectives.map(o => ({ id: o.id, description: o.description })),
          { containerIds, workspaceId }
        );
      } catch (err) {
        console.error(`[container-store] Auto RAFT extraction failed for doc ${documentId}:`, err);
      }
    })();
  }

  /**
   * Remove a document from a container.
   */
  async removeDocumentFromContainer(
    documentId: string,
    containerId: string
  ): Promise<void> {
    const pool = getPool();

    await pool.query(
      `DELETE FROM container_documents WHERE document_id = $1 AND container_id = $2`,
      [documentId, containerId]
    );
  }

  /**
   * Get documents not assigned to any container in the environment.
   */
  async getUnorganizedDocuments(environmentId: string): Promise<Record<string, unknown>[]> {
    const pool = getPool();

    // Get the problem set ID for this environment
    const mapping = await pool.query(
      `SELECT problem_set_id FROM problem_set_environments WHERE environment_id = $1`,
      [environmentId]
    );

    if (mapping.rows.length === 0) {
      return [];
    }

    const problemSetId = mapping.rows[0].problem_set_id;

    const result = await pool.query(`
      SELECT sd.*
      FROM strategic_documents sd
      WHERE (sd.workspace_id = $1 OR sd.workspace_id IS NULL)
        AND sd.id NOT IN (
          SELECT cd.document_id
          FROM container_documents cd
          JOIN strategic_containers sc ON sc.id = cd.container_id
          WHERE sc.environment_id = $2
        )
      ORDER BY sd.created_at DESC
    `, [problemSetId, environmentId]);

    return result.rows;
  }

  /**
   * Get containers a specific document belongs to.
   */
  async getDocumentContainers(documentId: string): Promise<StrategicContainer[]> {
    const pool = getPool();

    const result = await pool.query(`
      SELECT sc.*
      FROM strategic_containers sc
      JOIN container_documents cd ON cd.container_id = sc.id
      WHERE cd.document_id = $1
      ORDER BY sc.name
    `, [documentId]);

    return result.rows.map((r: Record<string, unknown>) => this.mapContainer(r));
  }

  // ---------------------------------------------------------------------------
  // Agent Assignments
  // ---------------------------------------------------------------------------

  /**
   * Assign an agent to a container.
   */
  async assignAgentToContainer(
    containerId: string,
    agentId: string,
    assignmentType: string = 'monitor',
    autoProcessNew: boolean = true,
    assignedBy: string
  ): Promise<string> {
    const pool = getPool();
    const id = randomUUID();

    await pool.query(
      `INSERT INTO container_agent_assignments (id, container_id, agent_id, assignment_type, auto_process_new, assigned_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (container_id, agent_id) DO UPDATE SET
         assignment_type = EXCLUDED.assignment_type,
         auto_process_new = EXCLUDED.auto_process_new`,
      [id, containerId, agentId, assignmentType, autoProcessNew, assignedBy]
    );

    return id;
  }

  /**
   * Get agent assignments for a container.
   */
  async getContainerAgentAssignments(containerId: string): Promise<ContainerAgentAssignment[]> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT * FROM container_agent_assignments WHERE container_id = $1 ORDER BY assigned_at`,
      [containerId]
    );

    return result.rows.map((r: Record<string, unknown>) => ({
      id: r.id as string,
      container_id: r.container_id as string,
      agent_id: r.agent_id as string,
      assignment_type: r.assignment_type as string,
      auto_process_new: r.auto_process_new as boolean,
      assigned_by: r.assigned_by as string,
      assigned_at: new Date(r.assigned_at as string),
    }));
  }

  /**
   * Get agents with auto-process enabled for a container.
   * Called after document assignment to trigger automatic processing.
   */
  async getAutoProcessAgents(containerId: string): Promise<Array<{ agentId: string; assignmentType: string }>> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT agent_id, assignment_type FROM container_agent_assignments
       WHERE container_id = $1 AND auto_process_new = true
       ORDER BY assigned_at`,
      [containerId]
    );

    return result.rows.map((r: Record<string, unknown>) => ({
      agentId: r.agent_id as string,
      assignmentType: r.assignment_type as string,
    }));
  }

  /**
   * Remove an agent assignment from a container.
   */
  async removeAgentFromContainer(
    containerId: string,
    agentId: string
  ): Promise<void> {
    const pool = getPool();

    await pool.query(
      `DELETE FROM container_agent_assignments WHERE container_id = $1 AND agent_id = $2`,
      [containerId, agentId]
    );
  }

  // ---------------------------------------------------------------------------
  // AI Container Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Use LLM to suggest container assignments for a document.
   * Analyzes the document's extracted text and existing containers.
   * Returns empty array on failure (non-blocking).
   */
  async suggestContainers(
    documentId: string,
    environmentId: string
  ): Promise<ContainerSuggestion[]> {
    try {
      const pool = getPool();

      // Fetch document text (first 3000 chars)
      const docResult = await pool.query(
        `SELECT text_content FROM strategic_documents WHERE id = $1`,
        [documentId]
      );
      if (docResult.rows.length === 0 || !docResult.rows[0].text_content) {
        return [];
      }
      const textContent = (docResult.rows[0].text_content as string).slice(0, 3000);

      // Fetch existing containers grouped by category
      const groups = await this.getContainersGroupedByCategory(environmentId);
      const containerList = groups
        .flatMap((g) =>
          g.containers.map((c) => ({
            id: c.id,
            name: c.name,
            category: g.category.name,
          }))
        );

      if (containerList.length === 0 && textContent.length < 50) {
        return [];
      }

      // Build prompt
      const containerListStr = containerList.length > 0
        ? containerList.map((c) => `- "${c.name}" (category: ${c.category}, id: ${c.id})`).join('\n')
        : '(No containers exist yet)';

      const systemPrompt = `You are a strategic document classifier. Analyze the document text and suggest which existing containers it belongs to. Return a JSON array.`;
      const userPrompt = `Existing containers:\n${containerListStr}\n\nDocument text (first 3000 chars):\n${textContent}\n\nInstructions:\n1. Return a JSON array of container suggestions.\n2. For matching existing containers, use: { "containerName": "name", "containerId": "id", "confidence": 0.0-1.0, "reasoning": "why" }\n3. Only include matches with confidence > 0.5\n4. If no existing container fits well, suggest a new one: { "containerName": "suggested name", "newContainerName": "suggested name", "suggestedCategory": "category name", "confidence": 0.8, "reasoning": "why" }\n5. Return ONLY valid JSON array, no other text.`;

      // Get LLM provider config
      const llmConfig = await configService.getLLMConfig();
      const providerType = llmConfig.provider === 'local' ? 'ollama' : llmConfig.provider;
      const providerConfig: ProviderConfig = {
        type: providerType as ProviderConfig['type'],
        model: llmConfig.models.extraction,
        apiKey: llmConfig.apiKey || undefined,
        baseUrl: llmConfig.baseUrl,
      };

      const provider = createProvider(providerConfig);
      const response = await provider.complete({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      // Parse JSON from response
      const content = response.content || '';
      // Try to extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (!jsonMatch) return [];

      const parsed = JSON.parse(jsonMatch[0]) as ContainerSuggestion[];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      console.error('suggestContainers failed (non-blocking):', err);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // Private Helpers
  // ---------------------------------------------------------------------------

  private mapEnvironment(row: Record<string, unknown>): StrategicEnvironment {
    return {
      id: row.id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      created_by: row.created_by as string,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  private mapContainer(row: Record<string, unknown>): StrategicContainer {
    return {
      id: row.id as string,
      environment_id: row.environment_id as string,
      category_id: row.category_id as string,
      name: row.name as string,
      description: row.description as string | undefined,
      created_by: row.created_by as string,
      created_at: new Date(row.created_at as string),
      updated_at: new Date(row.updated_at as string),
    };
  }

  private groupByCategory(rows: Record<string, unknown>[]): CategoryGroup[] {
    const categoryMap = new Map<string, CategoryGroup>();

    for (const row of rows) {
      const categoryId = row.category_id as string;

      if (!categoryMap.has(categoryId)) {
        categoryMap.set(categoryId, {
          category: {
            id: categoryId,
            environment_id: row.category_environment_id as string,
            name: row.category_name as string,
            color: row.category_color as string,
            display_order: row.display_order as number,
            is_default: row.is_default as boolean,
            created_at: new Date(row.category_created_at as string),
          },
          containers: [],
        });
      }

      const group = categoryMap.get(categoryId)!;

      // Only add container if it exists (LEFT JOIN may produce null container_id)
      if (row.container_id) {
        group.containers.push({
          id: row.container_id as string,
          environment_id: row.container_environment_id as string,
          category_id: row.container_category_id as string,
          name: row.container_name as string,
          description: row.container_description as string | undefined,
          created_by: row.container_created_by as string,
          created_at: new Date(row.container_created_at as string),
          updated_at: new Date(row.container_updated_at as string),
          document_count: row.document_count as number,
          agent_count: row.agent_count as number,
        });
      }
    }

    // Return sorted by display_order
    return Array.from(categoryMap.values()).sort(
      (a, b) => a.category.display_order - b.category.display_order
    );
  }
}
