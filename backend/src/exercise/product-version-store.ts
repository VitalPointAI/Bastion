/**
 * Product Version Store
 *
 * Phase 16 Plan 02: Version history CRUD for staff_product_versions table.
 * Stores every version snapshot of a staff product with full annotation payload.
 * Version numbers auto-increment per product.
 */

import { Pool } from 'pg';
import { randomUUID } from 'crypto';
import type { StaffProductVersion } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function toStaffProductVersion(row: Record<string, unknown>): StaffProductVersion {
  return {
    id: row.id as string,
    productId: row.product_id as string,
    version: row.version as number,
    content: (row.content as string) ?? '',
    structured: (row.structured as Record<string, unknown>) ?? {},
    createdBy: row.created_by as string,
    revisionNotes: (row.revision_notes as string | undefined) ?? undefined,
    annotatedFeedback: (row.annotated_feedback as StaffProductVersion['annotatedFeedback']) ?? undefined,
    createdAt: new Date(row.created_at as string),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────

export class ProductVersionStore {
  constructor(private pool: Pool) {}

  /**
   * Ensure a staff_products parent row exists for an AI draft product.
   * Uses INSERT ... ON CONFLICT DO NOTHING so it's safe to call every iteration.
   */
  async ensureProduct(
    productId: string,
    scenarioId: string,
    roleKey: string,
    productType: string,
    createdBy: string,
  ): Promise<void> {
    const title = `${roleKey.toUpperCase()} AI Draft`;
    await this.pool.query(
      `INSERT INTO staff_products (id, scenario_id, role_key, product_type, title, status, structured, content, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'draft', '{}', '', $6, NOW(), NOW())
       ON CONFLICT (id) DO NOTHING`,
      [productId, scenarioId, roleKey, productType, title, createdBy]
    );
  }

  /**
   * Create a new version snapshot for a product.
   * Version number is automatically set to max(existing versions) + 1.
   */
  async create(input: Omit<StaffProductVersion, 'id' | 'createdAt'>): Promise<StaffProductVersion> {
    const id = randomUUID();

    await this.pool.query(
      `INSERT INTO staff_product_versions
         (id, product_id, version, content, structured, created_by, revision_notes, annotated_feedback, created_at)
       VALUES (
         $1, $2,
         (SELECT COALESCE(MAX(version), 0) + 1 FROM staff_product_versions WHERE product_id = $2),
         $3, $4, $5, $6, $7, NOW()
       )`,
      [
        id,
        input.productId,
        input.content,
        JSON.stringify(input.structured),
        input.createdBy,
        input.revisionNotes ?? null,
        input.annotatedFeedback ? JSON.stringify(input.annotatedFeedback) : null,
      ]
    );

    const result = await this.pool.query(
      'SELECT * FROM staff_product_versions WHERE id = $1',
      [id]
    );
    return toStaffProductVersion(result.rows[0]);
  }

  /**
   * Find all versions for a product, ordered from oldest to newest
   */
  async findByProduct(productId: string): Promise<StaffProductVersion[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_product_versions
       WHERE product_id = $1
       ORDER BY version ASC`,
      [productId]
    );
    return result.rows.map(toStaffProductVersion);
  }

  /**
   * Find the most recent version of a product
   */
  async findLatestByProduct(productId: string): Promise<StaffProductVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM staff_product_versions
       WHERE product_id = $1
       ORDER BY version DESC
       LIMIT 1`,
      [productId]
    );
    return result.rows[0] ? toStaffProductVersion(result.rows[0]) : null;
  }

  /**
   * Find a specific version of a product by version number
   */
  async findByVersion(productId: string, version: number): Promise<StaffProductVersion | null> {
    const result = await this.pool.query(
      `SELECT * FROM staff_product_versions
       WHERE product_id = $1 AND version = $2`,
      [productId, version]
    );
    return result.rows[0] ? toStaffProductVersion(result.rows[0]) : null;
  }
}
