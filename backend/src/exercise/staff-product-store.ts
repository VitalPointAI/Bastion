/**
 * Staff Product Store
 *
 * Phase 15 Plan 01: CRUD operations for the staff_products table.
 * Manages workspace products created by JPP staff roles within exercise scenarios.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import type {
  StaffProduct,
  CreateStaffProductInput,
  UpdateStaffProductInput,
} from './types.js';
import { STAFF_ROLE_CONFIG, PRODUCT_TYPE_REGISTRY } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToProduct(row: Record<string, unknown>): StaffProduct {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    roleKey: row.role_key as string,
    productType: row.product_type as string,
    title: row.title as string,
    status: row.status as StaffProduct['status'],
    structured: (row.structured as Record<string, unknown>) ?? {},
    content: (row.content as string) ?? '',
    agentTeamId: (row.agent_team_id as string | null) ?? null,
    version: row.version as number,
    publishedAt: row.published_at ? new Date(row.published_at as string) : null,
    publishedBy: (row.published_by as string | null) ?? null,
    createdBy: row.created_by as string,
    createdAt: new Date(row.created_at as string),
    updatedAt: new Date(row.updated_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class StaffProductStore {
  private pool = getPool();

  /**
   * Create a new staff product (draft status, version 1)
   */
  async create(input: CreateStaffProductInput): Promise<StaffProduct> {
    const id = randomUUID();

    await this.pool.query(
      `INSERT INTO staff_products
         (id, scenario_id, role_key, product_type, title, status, structured, content, version, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, 1, $8, NOW(), NOW())`,
      [
        id,
        input.scenarioId,
        input.roleKey,
        input.productType,
        input.title,
        JSON.stringify(input.structured ?? {}),
        input.content ?? '',
        input.createdBy,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM staff_products WHERE id = $1',
      [id]
    );
    return rowToProduct(result.rows[0]);
  }

  /**
   * Find all products for a specific role in a scenario, ordered by creation time
   */
  async findByRole(scenarioId: string, roleKey: string): Promise<StaffProduct[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_products
       WHERE scenario_id = $1 AND role_key = $2
       ORDER BY created_at ASC`,
      [scenarioId, roleKey]
    );
    return result.rows.map(rowToProduct);
  }

  /**
   * Find a product by its ID
   */
  async findById(id: string): Promise<StaffProduct | null> {
    const result = await this.pool.query(
      'SELECT * FROM staff_products WHERE id = $1',
      [id]
    );
    return result.rows[0] ? rowToProduct(result.rows[0]) : null;
  }

  /**
   * Find a single product by scenario, role, and product type.
   * Used for upsert patterns (e.g., strategic import).
   */
  async findOne(
    scenarioId: string,
    roleKey: string,
    productType: string
  ): Promise<StaffProduct | null> {
    const result = await this.pool.query(
      `SELECT * FROM staff_products
       WHERE scenario_id = $1 AND role_key = $2 AND product_type = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [scenarioId, roleKey, productType]
    );
    return result.rows[0] ? rowToProduct(result.rows[0]) : null;
  }

  /**
   * Find all products for a scenario (across all roles)
   */
  async findByScenario(scenarioId: string): Promise<StaffProduct[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_products
       WHERE scenario_id = $1
       ORDER BY role_key ASC, created_at ASC`,
      [scenarioId]
    );
    return result.rows.map(rowToProduct);
  }

  /**
   * Update a product's draft content
   */
  async update(id: string, input: UpdateStaffProductInput): Promise<StaffProduct> {
    const setClauses: string[] = ['updated_at = NOW()'];
    const values: unknown[] = [];
    let i = 1;

    if (input.title !== undefined) {
      setClauses.push(`title = $${i++}`);
      values.push(input.title);
    }
    if (input.structured !== undefined) {
      setClauses.push(`structured = $${i++}`);
      values.push(JSON.stringify(input.structured));
    }
    if (input.content !== undefined) {
      setClauses.push(`content = $${i++}`);
      values.push(input.content);
    }

    values.push(id);
    await this.pool.query(
      `UPDATE staff_products SET ${setClauses.join(', ')} WHERE id = $${i}`,
      values
    );

    const result = await this.pool.query(
      'SELECT * FROM staff_products WHERE id = $1',
      [id]
    );
    return rowToProduct(result.rows[0]);
  }

  /**
   * Publish a product: set status='published', increment version,
   * record publisher and timestamp, return the updated product.
   */
  async publish(id: string, publishedBy: string): Promise<StaffProduct> {
    await this.pool.query(
      `UPDATE staff_products
       SET status = 'published',
           published_at = NOW(),
           published_by = $1,
           version = version + 1,
           updated_at = NOW()
       WHERE id = $2`,
      [publishedBy, id]
    );

    const result = await this.pool.query(
      'SELECT * FROM staff_products WHERE id = $1',
      [id]
    );
    return rowToProduct(result.rows[0]);
  }

  /**
   * Find all published products for a scenario (for Commander overview)
   */
  async findPublishedForScenario(scenarioId: string): Promise<StaffProduct[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_products
       WHERE scenario_id = $1 AND status = 'published'
       ORDER BY published_at DESC`,
      [scenarioId]
    );
    return result.rows.map(rowToProduct);
  }

  /**
   * Find the previous version of a product for diff computation.
   * Queries by scenario + role + product_type where version < current version.
   */
  async findPreviousVersion(
    scenarioId: string,
    roleKey: string,
    productType: string,
    currentVersion: number
  ): Promise<StaffProduct | null> {
    const result = await this.pool.query(
      `SELECT * FROM staff_products
       WHERE scenario_id = $1 AND role_key = $2 AND product_type = $3 AND version < $4
       ORDER BY version DESC
       LIMIT 1`,
      [scenarioId, roleKey, productType, currentVersion]
    );
    return result.rows[0] ? rowToProduct(result.rows[0]) : null;
  }

  /**
   * Delete a product (and cascade-delete its notifications via FK)
   */
  async delete(id: string): Promise<void> {
    await this.pool.query('DELETE FROM staff_products WHERE id = $1', [id]);
  }

  /**
   * Seed a role workspace with pre-populated draft products from Phase 14 data.
   *
   * Idempotent: if the workspace already has products, returns them unchanged.
   *
   * - J2: creates one ipb_assessment product per IPB assessment row (reference ID in structured)
   * - J35: creates one coa_development product per ScenarioCOA row
   * - J3: creates one execute_order product per ExerciseOrder row
   * - Commander: creates one coa_decision product per COA that has a commander_decision
   * - All other roles: creates default products from STAFF_ROLE_CONFIG.defaultProducts
   *
   * Per research anti-pattern: does NOT copy Phase 14 content into staff_products.content.
   * Only reference IDs are stored in the structured field. Content is reserved for the
   * user's own narrative.
   */
  async seedRoleWorkspace(scenarioId: string, roleKey: string): Promise<StaffProduct[]> {
    // Idempotency check: if already seeded, return existing
    const existing = await this.findByRole(scenarioId, roleKey);
    if (existing.length > 0) return existing;

    const seeded: StaffProduct[] = [];

    switch (roleKey) {
      case 'j2': {
        // Pull IPB assessments from Phase 14
        const ipbRows = await this.pool.query(
          'SELECT id, team, perspective, exercise_phase FROM ipb_assessments WHERE scenario_id = $1',
          [scenarioId]
        );
        for (const ipb of ipbRows.rows) {
          const product = await this.create({
            scenarioId,
            roleKey: 'j2',
            productType: 'ipb_assessment',
            title: `IPB — ${ipb.perspective === 'own' ? 'Own Forces' : 'Enemy Assessment'} — ${ipb.exercise_phase as string}`,
            structured: {
              ipbAssessmentId: ipb.id,
              team: ipb.team,
              perspective: ipb.perspective,
              exercisePhase: ipb.exercise_phase,
            },
            content: '',
            createdBy: 'system',
          });
          seeded.push(product);
        }
        break;
      }

      case 'j35': {
        // Pull COAs from Phase 14
        const coaRows = await this.pool.query(
          'SELECT id, name, team, exercise_phase, status FROM scenario_coas WHERE scenario_id = $1',
          [scenarioId]
        );
        for (const coa of coaRows.rows) {
          const product = await this.create({
            scenarioId,
            roleKey: 'j35',
            productType: 'coa_development',
            title: `COA: ${coa.name as string} — ${coa.exercise_phase as string}`,
            structured: {
              coaId: coa.id,
              team: coa.team,
              exercisePhase: coa.exercise_phase,
              status: coa.status,
            },
            content: '',
            createdBy: 'system',
          });
          seeded.push(product);
        }
        break;
      }

      case 'j3': {
        // Pull orders from Phase 14
        const orderRows = await this.pool.query(
          'SELECT id, order_type, title, exercise_phase, status FROM exercise_orders WHERE scenario_id = $1',
          [scenarioId]
        );
        for (const order of orderRows.rows) {
          const product = await this.create({
            scenarioId,
            roleKey: 'j3',
            productType: 'execute_order',
            title: `${order.order_type as string}: ${order.title as string}`,
            structured: {
              orderId: order.id,
              orderType: order.order_type,
              exercisePhase: order.exercise_phase,
            },
            content: '',
            createdBy: 'system',
          });
          seeded.push(product);
        }
        break;
      }

      case 'commander': {
        // Pull commander decisions from Phase 14 COAs
        const decisionRows = await this.pool.query(
          `SELECT sc.id, sc.name, sc.commander_decision, sc.exercise_phase
           FROM scenario_coas sc
           WHERE sc.scenario_id = $1 AND sc.commander_decision IS NOT NULL`,
          [scenarioId]
        );
        for (const dec of decisionRows.rows) {
          const product = await this.create({
            scenarioId,
            roleKey: 'commander',
            productType: 'coa_decision',
            title: `COA Decision: ${dec.name as string}`,
            structured: {
              coaId: dec.id,
              decision: dec.commander_decision,
              exercisePhase: dec.exercise_phase,
            },
            content: (dec.commander_decision as string) || '',
            createdBy: 'system',
          });
          seeded.push(product);
        }
        break;
      }

      default: {
        // All other roles: create empty default products from STAFF_ROLE_CONFIG
        const roleConfig = STAFF_ROLE_CONFIG[roleKey];
        if (roleConfig) {
          for (const productType of roleConfig.defaultProducts) {
            const registry = PRODUCT_TYPE_REGISTRY[productType];
            const product = await this.create({
              scenarioId,
              roleKey,
              productType,
              title: registry?.label ?? productType,
              structured: {},
              content: '',
              createdBy: 'system',
            });
            seeded.push(product);
          }
        }
      }
    }

    return seeded;
  }
}
