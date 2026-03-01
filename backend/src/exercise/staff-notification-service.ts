/**
 * Staff Notification Service
 *
 * Phase 15 Plan 01: Publish-to-notify pipeline with diff computation.
 * When a product is published, this service:
 * 1. Calls StaffProductStore.publish() to set status and version
 * 2. Computes a diff against the previous version
 * 3. Inserts staff_notifications rows for each enabled role (excluding source)
 * 4. Publishes a MessageBus event for real-time WebSocket delivery
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import { getMessageBus } from '../messaging/message-bus.js';
import { StaffProductStore } from './staff-product-store.js';
import type { StaffNotification, DiffSnapshot } from './types.js';

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToNotification(row: Record<string, unknown>): StaffNotification {
  return {
    id: row.id as string,
    scenarioId: row.scenario_id as string,
    sourceProductId: row.source_product_id as string,
    sourceRole: row.source_role as string,
    targetRole: row.target_role as string,
    notificationType: row.notification_type as StaffNotification['notificationType'],
    diffSnapshot: (row.diff_snapshot as DiffSnapshot) ?? { structuredChanges: [], contentChanged: false },
    isRead: row.is_read as boolean,
    isIntegrated: row.is_integrated as boolean,
    createdAt: new Date(row.created_at as string),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

/** Source DID used for all MessageBus events published by this service */
const SERVICE_DID = 'did:system:staff-notification-service';

export class StaffNotificationService {
  private pool = getPool();
  private staffProductStore = new StaffProductStore();

  /**
   * Publish a product and fan out notifications to all enabled roles.
   *
   * @param productId     - The product to publish
   * @param publishedBy   - DID of the user publishing
   * @param enabledRoles  - All roles enabled for this scenario (source role excluded internally)
   */
  async publishProduct(
    productId: string,
    publishedBy: string,
    enabledRoles: string[]
  ): Promise<void> {
    // 1. Publish the product and get the updated row
    const product = await this.staffProductStore.publish(productId, publishedBy);

    // 2. Compute diff against previous version
    const diffSnapshot = await this.computeDiff(product.scenarioId, product.roleKey, product.productType, product.version, product);

    // 3. Insert notifications for each enabled role (excluding source)
    const targetRoles = enabledRoles.filter((r) => r !== product.roleKey);

    if (targetRoles.length > 0) {
      const values: unknown[] = [];
      const rowPlaceholders: string[] = [];
      let paramIdx = 1;

      for (const targetRole of targetRoles) {
        const id = randomUUID();
        rowPlaceholders.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, 'product_published', $${paramIdx++}, NOW())`
        );
        values.push(
          id,
          product.scenarioId,
          productId,
          product.roleKey,
          targetRole,
          JSON.stringify(diffSnapshot)
        );
      }

      await this.pool.query(
        `INSERT INTO staff_notifications
           (id, scenario_id, source_product_id, source_role, target_role, notification_type, diff_snapshot, created_at)
         VALUES ${rowPlaceholders.join(', ')}`,
        values
      );
    }

    // 4. Publish MessageBus event for real-time delivery (non-blocking)
    const bus = getMessageBus();
    try {
      await bus.publish({
        sourceDid: SERVICE_DID,
        sourceType: 'system',
        destinationType: 'channel',
        destinationTarget: `exercise.staff.${product.scenarioId}`,
        messageType: 'staff.product.published',
        payload: {
          productId,
          sourceRole: product.roleKey,
          productType: product.productType,
          title: product.title,
          version: product.version,
          diff: diffSnapshot,
          targetRoles,
        },
      });
    } catch (err) {
      // Advisory only — do not fail the publish operation
      console.error('[StaffNotificationService] Failed to publish MessageBus event:', err);
    }
  }

  /**
   * Compute a diff snapshot by comparing the current product against the previous version.
   * Uses shallow field-by-field comparison on `structured`, plus a `contentChanged` flag.
   */
  private async computeDiff(
    scenarioId: string,
    roleKey: string,
    productType: string,
    currentVersion: number,
    current: { structured: Record<string, unknown>; content: string }
  ): Promise<DiffSnapshot> {
    // First publish (version 1 → 2 after publish): no previous to compare
    if (currentVersion <= 2) {
      return {
        structuredChanges: [],
        contentChanged: false,
        contentSummary: 'Initial publication',
      };
    }

    const previous = await this.staffProductStore.findPreviousVersion(
      scenarioId,
      roleKey,
      productType,
      currentVersion
    );

    if (!previous) {
      return {
        structuredChanges: [],
        contentChanged: false,
        contentSummary: 'Initial publication',
      };
    }

    // Shallow field-by-field comparison on structured
    const structuredChanges: DiffSnapshot['structuredChanges'] = [];
    const allKeys = new Set([
      ...Object.keys(previous.structured),
      ...Object.keys(current.structured),
    ]);

    for (const field of allKeys) {
      const oldValue = previous.structured[field];
      const newValue = current.structured[field];
      // Use JSON serialization for deep equality check
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        structuredChanges.push({ field, oldValue, newValue });
      }
    }

    const contentChanged = previous.content !== current.content;

    const snapshot: DiffSnapshot = { structuredChanges, contentChanged };
    if (contentChanged) {
      // Provide a summary (first 200 chars of the new content)
      snapshot.contentSummary = current.content.slice(0, 200) + (current.content.length > 200 ? '...' : '');
    }

    return snapshot;
  }

  /**
   * Get notifications for a target role in a scenario, ordered newest-first
   */
  async getNotifications(
    scenarioId: string,
    targetRole: string
  ): Promise<StaffNotification[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_notifications
       WHERE scenario_id = $1 AND target_role = $2
       ORDER BY created_at DESC`,
      [scenarioId, targetRole]
    );
    return result.rows.map(rowToNotification);
  }

  /**
   * Count unread notifications for a target role
   */
  async getUnreadCount(scenarioId: string, targetRole: string): Promise<number> {
    const result = await this.pool.query(
      `SELECT COUNT(*) FROM staff_notifications
       WHERE scenario_id = $1 AND target_role = $2 AND is_read = false`,
      [scenarioId, targetRole]
    );
    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Mark a single notification as read
   */
  async markRead(notificationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE staff_notifications SET is_read = true WHERE id = $1',
      [notificationId]
    );
  }

  /**
   * Mark a single notification as integrated (acknowledged by the receiving role)
   */
  async markIntegrated(notificationId: string): Promise<void> {
    await this.pool.query(
      'UPDATE staff_notifications SET is_integrated = true WHERE id = $1',
      [notificationId]
    );
  }

  /**
   * Get all notifications for a scenario (no role filter — for global bell icon)
   */
  async getAllNotifications(scenarioId: string): Promise<StaffNotification[]> {
    const result = await this.pool.query(
      `SELECT * FROM staff_notifications
       WHERE scenario_id = $1
       ORDER BY created_at DESC`,
      [scenarioId]
    );
    return result.rows.map(rowToNotification);
  }
}
