/**
 * Message Bus Error Classes
 *
 * Custom error types for message bus operations.
 */

/**
 * Base error class for message bus errors
 */
export class MessageBusError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'MessageBusError';
    // Maintains proper stack trace for where error was thrown
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when ABAC authorization check fails
 */
export class MessageAuthorizationError extends MessageBusError {
  constructor(
    message: string,
    public readonly subjectDid: string,
    public readonly objectClassification: string,
    public readonly denialReason: string
  ) {
    super(message, 'MESSAGE_AUTHORIZATION_FAILED');
    this.name = 'MessageAuthorizationError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      subjectDid: this.subjectDid,
      objectClassification: this.objectClassification,
      denialReason: this.denialReason,
    };
  }
}

/**
 * Error thrown when message delivery fails
 */
export class MessageDeliveryError extends MessageBusError {
  constructor(
    message: string,
    public readonly messageId: string,
    public readonly recipientDid: string,
    public readonly cause?: Error
  ) {
    super(message, 'MESSAGE_DELIVERY_FAILED');
    this.name = 'MessageDeliveryError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      messageId: this.messageId,
      recipientDid: this.recipientDid,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error thrown when message TTL is exceeded
 */
export class MessageExpiredError extends MessageBusError {
  constructor(
    public readonly messageId: string,
    public readonly expiredAt: Date
  ) {
    super(`Message ${messageId} expired at ${expiredAt.toISOString()}`, 'MESSAGE_EXPIRED');
    this.name = 'MessageExpiredError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      messageId: this.messageId,
      expiredAt: this.expiredAt.toISOString(),
    };
  }
}

/**
 * Error thrown when destination cannot be resolved
 */
export class InvalidDestinationError extends MessageBusError {
  constructor(
    public readonly destinationType: string,
    public readonly destinationTarget: string
  ) {
    super(
      `Invalid destination: ${destinationType}:${destinationTarget} could not be resolved`,
      'INVALID_DESTINATION'
    );
    this.name = 'InvalidDestinationError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      destinationType: this.destinationType,
      destinationTarget: this.destinationTarget,
    };
  }
}

/**
 * Error thrown when message validation fails
 */
export class MessageValidationError extends MessageBusError {
  constructor(
    message: string,
    public readonly validationErrors: string[]
  ) {
    super(message, 'MESSAGE_VALIDATION_FAILED');
    this.name = 'MessageValidationError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      validationErrors: this.validationErrors,
    };
  }
}

/**
 * Error thrown when message is not found
 */
export class MessageNotFoundError extends MessageBusError {
  constructor(public readonly messageId: string) {
    super(`Message ${messageId} not found`, 'MESSAGE_NOT_FOUND');
    this.name = 'MessageNotFoundError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      messageId: this.messageId,
    };
  }
}

/**
 * Error thrown when subscription is not found
 */
export class SubscriptionNotFoundError extends MessageBusError {
  constructor(public readonly subscriptionId: string) {
    super(`Subscription ${subscriptionId} not found`, 'SUBSCRIPTION_NOT_FOUND');
    this.name = 'SubscriptionNotFoundError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      subscriptionId: this.subscriptionId,
    };
  }
}

/**
 * Error thrown when request/response times out
 */
export class RequestTimeoutError extends MessageBusError {
  constructor(
    public readonly messageId: string,
    public readonly timeoutMs: number
  ) {
    super(`Request ${messageId} timed out after ${timeoutMs}ms`, 'REQUEST_TIMEOUT');
    this.name = 'RequestTimeoutError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      messageId: this.messageId,
      timeoutMs: this.timeoutMs,
    };
  }
}

/**
 * Error thrown when payload exceeds maximum size
 */
export class PayloadTooLargeError extends MessageBusError {
  constructor(
    public readonly payloadSize: number,
    public readonly maxSize: number
  ) {
    super(`Payload size ${payloadSize} exceeds maximum ${maxSize} bytes`, 'PAYLOAD_TOO_LARGE');
    this.name = 'PayloadTooLargeError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      payloadSize: this.payloadSize,
      maxSize: this.maxSize,
    };
  }
}

/**
 * Error thrown when sender lacks clearance to send at classification level
 */
export class InsufficientClearanceError extends MessageBusError {
  constructor(
    public readonly senderDid: string,
    public readonly senderClearance: string,
    public readonly requiredClearance: string
  ) {
    super(
      `Sender ${senderDid} has clearance ${senderClearance} but requires ${requiredClearance}`,
      'INSUFFICIENT_CLEARANCE'
    );
    this.name = 'InsufficientClearanceError';
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      senderDid: this.senderDid,
      senderClearance: this.senderClearance,
      requiredClearance: this.requiredClearance,
    };
  }
}
