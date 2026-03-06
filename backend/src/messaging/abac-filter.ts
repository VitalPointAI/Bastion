/**
 * ABAC Message Filter
 *
 * Authorization layer for message delivery using existing ABAC enforcer.
 * Ensures messages only reach recipients with appropriate clearance.
 */

import {
  ABACEnforcer,
  CLASSIFICATION_LEVELS,
  type SubjectAttributes,
  type ObjectAttributes,
} from '../security/abac-enforcer.js';
import { getAgentRegistry } from '../agents/registry.js';
import {
  type MessageEnvelope,
  type ABACDecision,
  type MessageClassification,
  type StoredMessage,
} from './types.js';
import { MessageAuthorizationError } from './errors.js';

/**
 * Result of a delivery authorization check
 */
export interface DeliveryAuthorizationResult {
  /** Whether delivery is allowed */
  allowed: boolean;
  /** Reason for denial (if denied) */
  reason?: string;
  /** Full ABAC decision for audit logging */
  decision: ABACDecision;
}

/**
 * Filtered message with authorization decision
 */
export interface FilteredMessage {
  message: MessageEnvelope | StoredMessage;
  authorization: DeliveryAuthorizationResult;
}

/**
 * Default subject attributes for unknown recipients
 */
const DEFAULT_SUBJECT_ATTRIBUTES: SubjectAttributes = {
  did: 'unknown',
  clearance: 'UNCLASS',
  nationality: 'USA',
  organization: 'unknown',
  role: 'unknown',
  caveats: {
    releasability: ['USA'],
    bilateral: [],
    specialAccess: [],
  },
};

/**
 * MessageABACFilter - Authorization layer for message delivery
 */
export class MessageABACFilter {
  private enforcer: ABACEnforcer;
  private initialized = false;

  constructor(enforcer?: ABACEnforcer) {
    this.enforcer = enforcer || new ABACEnforcer();
  }

  /**
   * Initialize the filter and ABAC enforcer
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.enforcer.initialize();
    this.initialized = true;
  }

  /**
   * Check if a recipient can receive a message
   */
  async canDeliver(
    message: MessageEnvelope | StoredMessage,
    recipientDid: string,
    recipientAttributes?: Partial<SubjectAttributes>
  ): Promise<DeliveryAuthorizationResult> {
    await this.ensureInitialized();

    // Get recipient's full attributes
    const subjectAttrs = await this.getRecipientAttributes(recipientDid, recipientAttributes);

    // Convert message attributes to ObjectAttributes
    const objectAttrs = this.messageToObjectAttributes(message);

    // Call ABAC enforcer
    const allowed = await this.enforcer.enforce(subjectAttrs, objectAttrs, 'read');

    // Build decision record for audit
    const decision = this.buildDecision(subjectAttrs, objectAttrs, allowed);

    return {
      allowed,
      reason: allowed ? undefined : decision.denialReason,
      decision,
    };
  }

  /**
   * Filter a batch of messages for a recipient
   * Returns only authorized messages with their decisions
   */
  async filterMessagesForRecipient(
    messages: (MessageEnvelope | StoredMessage)[],
    recipientDid: string,
    recipientAttributes?: Partial<SubjectAttributes>
  ): Promise<FilteredMessage[]> {
    await this.ensureInitialized();

    // Get recipient's attributes once for efficiency
    const subjectAttrs = await this.getRecipientAttributes(recipientDid, recipientAttributes);

    const filtered: FilteredMessage[] = [];

    for (const message of messages) {
      const objectAttrs = this.messageToObjectAttributes(message);
      const allowed = await this.enforcer.enforce(subjectAttrs, objectAttrs, 'read');
      const decision = this.buildDecision(subjectAttrs, objectAttrs, allowed);

      filtered.push({
        message,
        authorization: {
          allowed,
          reason: allowed ? undefined : decision.denialReason,
          decision,
        },
      });
    }

    return filtered;
  }

  /**
   * Filter messages and return only authorized ones
   */
  async getAuthorizedMessages(
    messages: (MessageEnvelope | StoredMessage)[],
    recipientDid: string,
    recipientAttributes?: Partial<SubjectAttributes>
  ): Promise<(MessageEnvelope | StoredMessage)[]> {
    const filtered = await this.filterMessagesForRecipient(
      messages,
      recipientDid,
      recipientAttributes
    );

    return filtered
      .filter(f => f.authorization.allowed)
      .map(f => f.message);
  }

  /**
   * Check if sender has clearance to send at classification level
   */
  async canSendAtClassification(
    senderDid: string,
    classification: MessageClassification,
    senderAttributes?: Partial<SubjectAttributes>
  ): Promise<boolean> {
    await this.ensureInitialized();

    const subjectAttrs = await this.getRecipientAttributes(senderDid, senderAttributes);
    const senderLevel = CLASSIFICATION_LEVELS[subjectAttrs.clearance] ?? 0;
    const messageLevel = CLASSIFICATION_LEVELS[classification] ?? 0;

    // Sender must have clearance >= message classification
    return senderLevel >= messageLevel;
  }

  /**
   * Get downgraded payload for recipient with lower clearance
   * Note: This is a placeholder for future implementation
   * Currently returns null if downgrade would be needed
   */
  getDowngradedPayload(
    message: MessageEnvelope | StoredMessage,
    recipientClearance: MessageClassification
  ): unknown | null {
    const messageAttrs = this.messageToObjectAttributes(message);
    const messageLevel = CLASSIFICATION_LEVELS[messageAttrs.classification] ?? 0;
    const recipientLevel = CLASSIFICATION_LEVELS[recipientClearance] ?? 0;

    // If recipient has sufficient clearance, return original payload
    if (recipientLevel >= messageLevel) {
      return 'payload' in message ? message.payload : (message as StoredMessage).payload;
    }

    // For now, we don't support automatic downgrading
    // This would require content-aware redaction
    return null;
  }

  /**
   * Validate message can be delivered and throw if not
   */
  async validateDelivery(
    message: MessageEnvelope | StoredMessage,
    recipientDid: string,
    recipientAttributes?: Partial<SubjectAttributes>
  ): Promise<void> {
    const result = await this.canDeliver(message, recipientDid, recipientAttributes);

    if (!result.allowed) {
      const _messageId = message.messageId;
      const classification = this.getClassification(message);

      throw new MessageAuthorizationError(
        `Delivery to ${recipientDid} denied: ${result.reason}`,
        recipientDid,
        classification,
        result.reason || 'Unknown reason'
      );
    }
  }

  /**
   * Get recipient attributes from registry or defaults
   */
  private async getRecipientAttributes(
    recipientDid: string,
    providedAttributes?: Partial<SubjectAttributes>
  ): Promise<SubjectAttributes> {
    // Start with defaults
    let attrs: SubjectAttributes = { ...DEFAULT_SUBJECT_ATTRIBUTES, did: recipientDid };

    // Try to get agent attributes from registry
    if (recipientDid.startsWith('did:near:agent-')) {
      const registry = getAgentRegistry();
      await registry.ensureInitialized();

      const agent = registry.getAgentByDID(recipientDid);
      if (agent) {
        // Agents inherit classification from system config
        // For now, default to UNCLASS - can be enhanced later
        attrs = {
          did: recipientDid,
          clearance: 'UNCLASS', // TODO: Add clearance to agent manifest
          nationality: 'USA',
          organization: 'system',
          role: 'agent',
          caveats: {
            releasability: ['USA'],
            bilateral: [],
            specialAccess: [],
          },
        };
      }
    }

    // Override with provided attributes
    if (providedAttributes) {
      attrs = {
        ...attrs,
        ...providedAttributes,
        caveats: {
          ...attrs.caveats,
          ...providedAttributes.caveats,
        },
      };
    }

    return attrs;
  }

  /**
   * Convert message attributes to ABAC ObjectAttributes
   */
  private messageToObjectAttributes(message: MessageEnvelope | StoredMessage): ObjectAttributes {
    // Handle both MessageEnvelope and StoredMessage formats
    if ('attributes' in message) {
      // MessageEnvelope format
      return {
        classification: message.attributes.classification,
        releasability: message.attributes.releasability,
        dissemination: message.attributes.dissemination,
        originator: message.attributes.originator,
        orcon: message.attributes.orcon,
      };
    } else {
      // StoredMessage format
      return {
        classification: message.classification,
        releasability: message.releasability,
        dissemination: message.dissemination,
        originator: message.originator,
        orcon: message.orcon,
      };
    }
  }

  /**
   * Get classification from message (handles both formats)
   */
  private getClassification(message: MessageEnvelope | StoredMessage): MessageClassification {
    if ('attributes' in message) {
      return message.attributes.classification;
    }
    return message.classification;
  }

  /**
   * Build ABAC decision record for audit logging
   */
  private buildDecision(
    subject: SubjectAttributes,
    object: ObjectAttributes,
    allowed: boolean
  ): ABACDecision {
    const subjectLevel = CLASSIFICATION_LEVELS[subject.clearance] ?? 0;
    const objectLevel = CLASSIFICATION_LEVELS[object.classification] ?? 0;

    // Check clearance
    const clearancePass = subjectLevel >= objectLevel;

    // Check releasability
    const releasabilityPass = object.releasability.length === 0 ||
      object.releasability.includes(subject.nationality) ||
      (object.releasability.includes('FVEY') && ['USA', 'GBR', 'CAN', 'AUS', 'NZL'].includes(subject.nationality));

    // Check dissemination (NOFORN)
    const nofornPass = !object.dissemination.includes('NOFORN') || subject.nationality === 'USA';
    const failedControl = !nofornPass ? 'NOFORN' : undefined;

    // Determine denial reason
    let denialReason: string | undefined;
    if (!clearancePass) {
      denialReason = `Subject clearance ${subject.clearance} insufficient for ${object.classification}`;
    } else if (!releasabilityPass) {
      denialReason = `Subject nationality ${subject.nationality} not in releasability: ${object.releasability.join(', ')}`;
    } else if (!nofornPass) {
      denialReason = 'NOFORN restriction - subject is not US national';
    }

    return {
      subjectClearance: subject.clearance as MessageClassification,
      objectClassification: object.classification,
      releasabilityCheck: {
        passed: releasabilityPass,
        subjectNationality: subject.nationality,
        objectReleasability: object.releasability,
      },
      disseminationCheck: {
        passed: nofornPass,
        controls: object.dissemination,
        failedControl,
      },
      allowed,
      denialReason,
    };
  }

  /**
   * Ensure filter is initialized
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

let filterInstance: MessageABACFilter | null = null;

/**
 * Get or create the ABAC filter singleton
 */
export function getMessageABACFilter(): MessageABACFilter {
  if (!filterInstance) {
    filterInstance = new MessageABACFilter();
  }
  return filterInstance;
}
