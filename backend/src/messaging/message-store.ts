/**
 * Message Store
 *
 * PostgreSQL-backed message persistence with audit trail.
 * Provides reliable storage and querying for the message bus.
 */

import { randomUUID } from 'crypto';
import { getPool } from '../lib/database.js';
import {
  DeliveryStatus,
  type MessageEnvelope,
  type StoredMessage,
  type MessageDelivery,
  type ABACDecision,
  type MessageQueryOptions,
  type MessageClassification,
  type MessagePriority,
} from './types.js';
import { DEFAULT_TTL } from './schemas.js';

/**
 * SQL for initializing message tables
 */
const INIT_SQL = `
  -- Messages table
  CREATE TABLE IF NOT EXISTS messages (
    message_id UUID PRIMARY KEY,
    correlation_id UUID,
    timestamp TIMESTAMPTZ NOT NULL,
    source_did TEXT NOT NULL,
    source_type TEXT NOT NULL,
    destination_type TEXT NOT NULL,
    destination_target TEXT NOT NULL,
    classification TEXT NOT NULL,
    releasability JSONB NOT NULL DEFAULT '[]',
    dissemination JSONB NOT NULL DEFAULT '[]',
    originator TEXT NOT NULL,
    orcon BOOLEAN NOT NULL DEFAULT FALSE,
    message_type TEXT NOT NULL,
    payload JSONB NOT NULL,
    priority TEXT NOT NULL DEFAULT 'normal',
    ttl INTEGER,
    requires_ack BOOLEAN NOT NULL DEFAULT FALSE,
    status TEXT NOT NULL DEFAULT 'pending',
    delivered_at TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Indexes for efficient querying
  CREATE INDEX IF NOT EXISTS idx_messages_source_did ON messages(source_did);
  CREATE INDEX IF NOT EXISTS idx_messages_destination_target ON messages(destination_target);
  CREATE INDEX IF NOT EXISTS idx_messages_message_type ON messages(message_type);
  CREATE INDEX IF NOT EXISTS idx_messages_classification ON messages(classification);
  CREATE INDEX IF NOT EXISTS idx_messages_correlation_id ON messages(correlation_id);
  CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
  CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);

  -- Message deliveries table (audit trail)
  CREATE TABLE IF NOT EXISTS message_deliveries (
    delivery_id UUID PRIMARY KEY,
    message_id UUID NOT NULL REFERENCES messages(message_id),
    recipient_did TEXT NOT NULL,
    attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    status TEXT NOT NULL,
    error_message TEXT,
    abac_decision JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  );

  -- Indexes for delivery audit
  CREATE INDEX IF NOT EXISTS idx_message_deliveries_message_id ON message_deliveries(message_id);
  CREATE INDEX IF NOT EXISTS idx_message_deliveries_recipient_did ON message_deliveries(recipient_did);
  CREATE INDEX IF NOT EXISTS idx_message_deliveries_status ON message_deliveries(status);
`;

/**
 * MessageStore - PostgreSQL persistence layer for messages
 */
export class MessageStore {
  private initialized = false;

  /**
   * Initialize database tables
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const pool = getPool();
    try {
      await pool.query(INIT_SQL);
      this.initialized = true;
      console.log('[MessageStore] Database tables initialized');
    } catch (error) {
      console.error('[MessageStore] Failed to initialize database tables:', error);
      throw error;
    }
  }

  /**
   * Store a new message
   */
  async storeMessage(envelope: MessageEnvelope): Promise<string> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      await pool.query(
        `INSERT INTO messages (
          message_id, correlation_id, timestamp,
          source_did, source_type,
          destination_type, destination_target,
          classification, releasability, dissemination,
          originator, orcon,
          message_type, payload,
          priority, ttl, requires_ack,
          status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)`,
        [
          envelope.messageId,
          envelope.correlationId || null,
          envelope.timestamp,
          envelope.source.did,
          envelope.source.type,
          envelope.destination.type,
          envelope.destination.target,
          envelope.attributes.classification,
          JSON.stringify(envelope.attributes.releasability),
          JSON.stringify(envelope.attributes.dissemination),
          envelope.attributes.originator,
          envelope.attributes.orcon,
          envelope.messageType,
          JSON.stringify(envelope.payload),
          envelope.priority,
          envelope.ttl || DEFAULT_TTL,
          envelope.requiresAck || false,
          DeliveryStatus.Pending,
        ]
      );

      return envelope.messageId;
    } catch (error) {
      console.error('[MessageStore] Failed to store message:', { messageId: envelope.messageId, error });
      throw error;
    }
  }

  /**
   * Update message delivery status
   */
  async updateStatus(
    messageId: string,
    status: DeliveryStatus,
    timestamp?: Date
  ): Promise<void> {
    await this.ensureInitialized();
    const pool = getPool();

    let query: string;
    let params: (string | Date)[];

    switch (status) {
      case DeliveryStatus.Delivered:
        query = `UPDATE messages SET status = $1, delivered_at = $2 WHERE message_id = $3`;
        params = [status, timestamp || new Date(), messageId];
        break;
      case DeliveryStatus.Acknowledged:
        query = `UPDATE messages SET status = $1, acknowledged_at = $2 WHERE message_id = $3`;
        params = [status, timestamp || new Date(), messageId];
        break;
      default:
        query = `UPDATE messages SET status = $1 WHERE message_id = $2`;
        params = [status, messageId];
    }

    try {
      const result = await pool.query(query, params);
      if (result.rowCount === 0) {
        console.warn('[MessageStore] No message found to update:', messageId);
      }
    } catch (error) {
      console.error('[MessageStore] Failed to update status:', { messageId, status, error });
      throw error;
    }
  }

  /**
   * Record a delivery attempt (audit trail)
   */
  async recordDelivery(
    messageId: string,
    recipientDid: string,
    status: DeliveryStatus,
    abacDecision?: ABACDecision,
    errorMessage?: string
  ): Promise<string> {
    await this.ensureInitialized();
    const pool = getPool();

    const deliveryId = randomUUID();

    try {
      await pool.query(
        `INSERT INTO message_deliveries (
          delivery_id, message_id, recipient_did, status, error_message, abac_decision
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          deliveryId,
          messageId,
          recipientDid,
          status,
          errorMessage || null,
          abacDecision ? JSON.stringify(abacDecision) : null,
        ]
      );

      return deliveryId;
    } catch (error) {
      console.error('[MessageStore] Failed to record delivery:', { messageId, recipientDid, error });
      throw error;
    }
  }

  /**
   * Get a message by ID
   */
  async getMessageById(messageId: string): Promise<StoredMessage | null> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query('SELECT * FROM messages WHERE message_id = $1', [messageId]);

      if (result.rows.length === 0) {
        return null;
      }

      return this.rowToStoredMessage(result.rows[0]);
    } catch (error) {
      console.error('[MessageStore] Failed to get message:', { messageId, error });
      throw error;
    }
  }

  /**
   * Get messages for a recipient with ABAC filtering applied externally
   */
  async getMessagesForRecipient(
    recipientDid: string,
    options: MessageQueryOptions = {}
  ): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = ['destination_target = $1'];
    const params: (string | number)[] = [recipientDid];
    let paramIndex = 2;

    if (options.channel) {
      conditions.push(`destination_target = $${paramIndex}`);
      params.push(options.channel);
      paramIndex++;
    }

    if (options.messageType) {
      conditions.push(`message_type = $${paramIndex}`);
      params.push(options.messageType);
      paramIndex++;
    }

    if (options.since) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(options.since);
      paramIndex++;
    }

    if (options.status) {
      conditions.push(`status = $${paramIndex}`);
      params.push(options.status);
      paramIndex++;
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    params.push(limit);
    params.push(offset);

    const query = `
      SELECT * FROM messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      const result = await pool.query(query, params);
      return result.rows.map(row => this.rowToStoredMessage(row));
    } catch (error) {
      console.error('[MessageStore] Failed to get messages for recipient:', { recipientDid, error });
      throw error;
    }
  }

  /**
   * Get messages from a channel
   */
  async getChannelMessages(
    channel: string,
    options: MessageQueryOptions = {}
  ): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const pool = getPool();

    const conditions: string[] = ["destination_type = 'channel'", 'destination_target = $1'];
    const params: (string | number)[] = [channel];
    let paramIndex = 2;

    if (options.messageType) {
      conditions.push(`message_type = $${paramIndex}`);
      params.push(options.messageType);
      paramIndex++;
    }

    if (options.since) {
      conditions.push(`timestamp >= $${paramIndex}`);
      params.push(options.since);
      paramIndex++;
    }

    const limit = options.limit || 100;
    const offset = options.offset || 0;

    params.push(limit);
    params.push(offset);

    const query = `
      SELECT * FROM messages
      WHERE ${conditions.join(' AND ')}
      ORDER BY timestamp DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    try {
      const result = await pool.query(query, params);
      return result.rows.map(row => this.rowToStoredMessage(row));
    } catch (error) {
      console.error('[MessageStore] Failed to get channel messages:', { channel, error });
      throw error;
    }
  }

  /**
   * Get message thread by correlation ID
   */
  async getMessageHistory(correlationId: string): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT * FROM messages
         WHERE correlation_id = $1 OR message_id = $1
         ORDER BY timestamp ASC`,
        [correlationId]
      );

      return result.rows.map(row => this.rowToStoredMessage(row));
    } catch (error) {
      console.error('[MessageStore] Failed to get message history:', { correlationId, error });
      throw error;
    }
  }

  /**
   * Get delivery audit trail for a message
   */
  async getDeliveryAudit(messageId: string): Promise<MessageDelivery[]> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT * FROM message_deliveries WHERE message_id = $1 ORDER BY attempted_at ASC`,
        [messageId]
      );

      return result.rows.map(row => ({
        deliveryId: row.delivery_id,
        messageId: row.message_id,
        recipientDid: row.recipient_did,
        attemptedAt: new Date(row.attempted_at),
        status: row.status as DeliveryStatus,
        errorMessage: row.error_message,
        abacDecision: row.abac_decision as ABACDecision | null,
      }));
    } catch (error) {
      console.error('[MessageStore] Failed to get delivery audit:', { messageId, error });
      throw error;
    }
  }

  /**
   * Mark expired messages (TTL exceeded)
   */
  async expireMessages(): Promise<number> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(`
        UPDATE messages
        SET status = $1
        WHERE status = $2
          AND ttl IS NOT NULL
          AND timestamp + (ttl || ' seconds')::INTERVAL < NOW()
      `, [DeliveryStatus.Expired, DeliveryStatus.Pending]);

      const expiredCount = result.rowCount || 0;
      if (expiredCount > 0) {
        console.log(`[MessageStore] Expired ${expiredCount} messages`);
      }

      return expiredCount;
    } catch (error) {
      console.error('[MessageStore] Failed to expire messages:', error);
      throw error;
    }
  }

  /**
   * Get pending messages for delivery
   */
  async getPendingMessages(limit: number = 100): Promise<StoredMessage[]> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT * FROM messages
         WHERE status = $1
         ORDER BY
           CASE priority
             WHEN 'critical' THEN 1
             WHEN 'high' THEN 2
             WHEN 'normal' THEN 3
             WHEN 'low' THEN 4
           END,
           timestamp ASC
         LIMIT $2`,
        [DeliveryStatus.Pending, limit]
      );

      return result.rows.map(row => this.rowToStoredMessage(row));
    } catch (error) {
      console.error('[MessageStore] Failed to get pending messages:', error);
      throw error;
    }
  }

  /**
   * Count messages by status
   */
  async countByStatus(): Promise<Record<string, number>> {
    await this.ensureInitialized();
    const pool = getPool();

    try {
      const result = await pool.query(
        `SELECT status, COUNT(*) as count FROM messages GROUP BY status`
      );

      const counts: Record<string, number> = {};
      for (const row of result.rows) {
        counts[row.status] = parseInt(row.count, 10);
      }

      return counts;
    } catch (error) {
      console.error('[MessageStore] Failed to count by status:', error);
      throw error;
    }
  }

  /**
   * Convert database row to StoredMessage
   */
  private rowToStoredMessage(row: Record<string, unknown>): StoredMessage {
    return {
      messageId: row.message_id as string,
      correlationId: row.correlation_id as string | null,
      timestamp: new Date(row.timestamp as string),
      sourceDid: row.source_did as string,
      sourceType: row.source_type as 'agent' | 'user' | 'system',
      destinationType: row.destination_type as 'agent' | 'team' | 'channel' | 'broadcast',
      destinationTarget: row.destination_target as string,
      classification: row.classification as MessageClassification,
      releasability: row.releasability as string[],
      dissemination: row.dissemination as string[],
      originator: row.originator as string,
      orcon: row.orcon as boolean,
      messageType: row.message_type as string,
      payload: row.payload,
      priority: row.priority as MessagePriority,
      ttl: row.ttl as number | null,
      requiresAck: row.requires_ack as boolean,
      status: row.status as DeliveryStatus,
      deliveredAt: row.delivered_at ? new Date(row.delivered_at as string) : null,
      acknowledgedAt: row.acknowledged_at ? new Date(row.acknowledged_at as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }

  /**
   * Convert StoredMessage to MessageEnvelope
   */
  storedMessageToEnvelope(stored: StoredMessage): MessageEnvelope {
    return {
      messageId: stored.messageId,
      correlationId: stored.correlationId || undefined,
      timestamp: stored.timestamp.toISOString(),
      source: {
        did: stored.sourceDid,
        type: stored.sourceType,
      },
      destination: {
        type: stored.destinationType,
        target: stored.destinationTarget,
      },
      attributes: {
        classification: stored.classification,
        releasability: stored.releasability,
        dissemination: stored.dissemination,
        originator: stored.originator,
        orcon: stored.orcon,
      },
      messageType: stored.messageType,
      payload: stored.payload,
      priority: stored.priority,
      ttl: stored.ttl || undefined,
      requiresAck: stored.requiresAck,
      status: stored.status,
      deliveredAt: stored.deliveredAt?.toISOString(),
      acknowledgedAt: stored.acknowledgedAt?.toISOString(),
    };
  }

  /**
   * Ensure database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// ==========================================================================
// Singleton Instance
// ==========================================================================

let storeInstance: MessageStore | null = null;

/**
 * Get or create the message store singleton
 */
export function getMessageStore(): MessageStore {
  if (!storeInstance) {
    storeInstance = new MessageStore();
  }
  return storeInstance;
}
