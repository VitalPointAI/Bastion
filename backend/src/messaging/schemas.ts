/**
 * Message Bus Zod Schemas
 *
 * Validation schemas for message envelope and related types.
 * Integrates with existing ABAC classification levels.
 */

import { z } from 'zod';
import { DeliveryStatus } from './types.js';

/**
 * Classification level schema - aligned with ABAC enforcer
 */
export const MessageClassificationSchema = z.enum([
  'UNCLASS',
  'CUI',
  'CONFIDENTIAL',
  'SECRET',
  'TOPSECRET',
]);

/**
 * Message priority schema
 */
export const MessagePrioritySchema = z.enum(['low', 'normal', 'high', 'critical']);

/**
 * Delivery status schema
 */
export const DeliveryStatusSchema = z.nativeEnum(DeliveryStatus);

/**
 * Message source type schema
 */
export const MessageSourceTypeSchema = z.enum(['agent', 'user', 'system']);

/**
 * Message source schema
 */
export const MessageSourceSchema = z.object({
  did: z.string().min(1, 'Source DID is required'),
  type: MessageSourceTypeSchema,
});

/**
 * Destination type schema
 */
export const DestinationTypeSchema = z.enum(['agent', 'team', 'channel', 'broadcast']);

/**
 * Message destination schema
 */
export const MessageDestinationSchema = z.object({
  type: DestinationTypeSchema,
  target: z.string().min(1, 'Destination target is required'),
});

/**
 * Message attributes schema (security/ABAC)
 */
export const MessageAttributesSchema = z.object({
  classification: MessageClassificationSchema,
  releasability: z.array(z.string()).default([]),
  dissemination: z.array(z.string()).default([]),
  originator: z.string().min(1, 'Originator DID is required'),
  orcon: z.boolean().default(false),
});

/**
 * Full message envelope schema
 */
export const MessageEnvelopeSchema = z.object({
  messageId: z.string().uuid('Invalid message ID format'),
  correlationId: z.string().uuid('Invalid correlation ID format').optional(),
  timestamp: z.string().datetime({ message: 'Invalid timestamp format' }),

  // Routing
  source: MessageSourceSchema,
  destination: MessageDestinationSchema,

  // Security attributes
  attributes: MessageAttributesSchema,

  // Payload
  messageType: z.string().min(1, 'Message type is required').max(100, 'Message type too long'),
  payload: z.unknown(),

  // Delivery tracking
  priority: MessagePrioritySchema.default('normal'),
  ttl: z.number().int().positive().optional(),
  requiresAck: z.boolean().optional(),

  // Status (optional, populated by system)
  status: DeliveryStatusSchema.optional(),
  deliveredAt: z.string().datetime().optional(),
  acknowledgedAt: z.string().datetime().optional(),
});

/**
 * Schema for creating a new message
 */
export const CreateMessageSchema = z.object({
  sourceDid: z.string().min(1, 'Source DID is required'),
  sourceType: MessageSourceTypeSchema.default('user'),
  destinationType: DestinationTypeSchema,
  destinationTarget: z.string().min(1, 'Destination target is required'),

  messageType: z.string().min(1).max(100),
  payload: z.unknown(),

  // Optional attributes with defaults
  attributes: z
    .object({
      classification: MessageClassificationSchema.optional(),
      releasability: z.array(z.string()).optional(),
      dissemination: z.array(z.string()).optional(),
      originator: z.string().optional(),
      orcon: z.boolean().optional(),
    })
    .optional(),

  priority: MessagePrioritySchema.default('normal'),
  ttl: z.number().int().positive().optional(),
  correlationId: z.string().uuid().optional(),
  requiresAck: z.boolean().default(false),
});

/**
 * Schema for message subscription
 */
export const MessageSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid(),
  subscriberDid: z.string().min(1),
  channels: z.array(z.string()).default([]),
  messageTypes: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  active: z.boolean().default(true),
});

/**
 * Schema for subscription options
 */
export const SubscriptionOptionsSchema = z.object({
  channels: z.array(z.string()).optional(),
  messageTypes: z.array(z.string()).optional(),
});

/**
 * Schema for message query options
 */
export const MessageQueryOptionsSchema = z.object({
  channel: z.string().optional(),
  messageType: z.string().optional(),
  since: z.string().datetime().optional(),
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  status: DeliveryStatusSchema.optional(),
});

/**
 * ABAC decision schema for audit logging
 */
export const ABACDecisionSchema = z.object({
  subjectClearance: MessageClassificationSchema,
  objectClassification: MessageClassificationSchema,
  releasabilityCheck: z.object({
    passed: z.boolean(),
    subjectNationality: z.string().optional(),
    objectReleasability: z.array(z.string()).optional(),
  }),
  disseminationCheck: z.object({
    passed: z.boolean(),
    controls: z.array(z.string()).optional(),
    failedControl: z.string().optional(),
  }),
  allowed: z.boolean(),
  denialReason: z.string().optional(),
});

/**
 * Schema for message delivery record
 */
export const MessageDeliverySchema = z.object({
  deliveryId: z.string().uuid(),
  messageId: z.string().uuid(),
  recipientDid: z.string().min(1),
  attemptedAt: z.date(),
  status: DeliveryStatusSchema,
  errorMessage: z.string().nullable(),
  abacDecision: ABACDecisionSchema.nullable(),
});

// Type inference exports
export type MessageEnvelopeInput = z.input<typeof MessageEnvelopeSchema>;
export type MessageEnvelopeOutput = z.output<typeof MessageEnvelopeSchema>;
export type CreateMessageInput = z.input<typeof CreateMessageSchema>;
export type CreateMessageOutput = z.output<typeof CreateMessageSchema>;
export type MessageQueryOptionsInput = z.input<typeof MessageQueryOptionsSchema>;
export type ABACDecisionInput = z.input<typeof ABACDecisionSchema>;

/**
 * Maximum payload size in bytes (1MB)
 */
export const MAX_PAYLOAD_SIZE = 1024 * 1024;

/**
 * Default TTL in seconds (24 hours)
 */
export const DEFAULT_TTL = 86400;

/**
 * Validate payload size
 */
export function validatePayloadSize(payload: unknown): boolean {
  const serialized = JSON.stringify(payload);
  return serialized.length <= MAX_PAYLOAD_SIZE;
}
