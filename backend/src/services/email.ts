/**
 * Email Service - AWS SES Integration
 *
 * Provides email sending functionality for authentication flows.
 * Falls back to console logging in development mode when AWS credentials
 * are not configured.
 */

import { SESClient, SendEmailCommand, GetIdentityVerificationAttributesCommand } from '@aws-sdk/client-ses';
import {
  loginMagicLinkTemplate,
  registrationMagicLinkTemplate,
  recoveryEmailTemplate,
} from '../templates/email/index.js';

// Initialize SES client if AWS credentials are configured
const sesClient = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  ? new SESClient({
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      }
    })
  : null;

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@bastion.ai';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/**
 * SES connection validation result
 */
export interface SESValidationStatus {
  configured: boolean;
  verified: boolean;
  sandbox: boolean;
}

/**
 * Validates SES connection and checks domain/email verification status.
 * - Checks if SES client is configured (AWS credentials present)
 * - Attempts to verify the FROM_EMAIL domain/identity
 * - Returns status object for health checks and startup logging
 */
export async function validateSESConnection(): Promise<SESValidationStatus> {
  // If no SES client configured, return early
  if (!sesClient) {
    console.log('[SES] Not configured - using dev mode (console logging)');
    return { configured: false, verified: false, sandbox: true };
  }

  try {
    // Extract domain from FROM_EMAIL for verification check
    const domain = FROM_EMAIL.includes('@') ? FROM_EMAIL.split('@')[1] : FROM_EMAIL;

    const command = new GetIdentityVerificationAttributesCommand({
      Identities: [FROM_EMAIL, domain]
    });

    const response = await sesClient.send(command);
    const attributes = response.VerificationAttributes || {};

    // Check if either the email or domain is verified
    const emailStatus = attributes[FROM_EMAIL];
    const domainStatus = attributes[domain];

    const verified =
      (emailStatus?.VerificationStatus === 'Success') ||
      (domainStatus?.VerificationStatus === 'Success');

    // Note: Detecting sandbox mode requires GetAccount API which needs additional permissions
    // For now, we assume production if credentials are configured and verified
    const sandbox = !verified;

    console.log(`[SES] Configured: true, Verified: ${verified}, Sandbox: ${sandbox}`);
    console.log(`[SES] FROM_EMAIL: ${FROM_EMAIL}`);

    return { configured: true, verified, sandbox };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[SES] Validation error: ${message}`);
    // If we can't validate, assume sandbox mode for safety
    return { configured: true, verified: false, sandbox: true };
  }
}

/**
 * Sends a magic link email for login (returning users).
 * In development mode (no AWS credentials), logs the link to console instead.
 */
export async function sendLoginMagicLinkEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

  // Development fallback: log to console if no AWS credentials
  if (!sesClient) {
    console.log('\n========================================');
    console.log('[DEV MODE] Login magic link generated!');
    console.log(`Email: ${email}`);
    console.log(`Verify URL: ${verifyUrl}`);
    console.log('========================================\n');
    return;
  }

  // Production: send via Amazon SES
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Sign in to BASTION',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: loginMagicLinkTemplate(verifyUrl),
          Charset: 'UTF-8'
        }
      }
    }
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send login email via SES: ${message}`);
  }
}

/**
 * Sends a magic link email for registration (new users).
 * In development mode (no AWS credentials), logs the link to console instead.
 */
export async function sendRegistrationMagicLinkEmail(email: string, token: string): Promise<void> {
  const verifyUrl = `${APP_URL}/auth/verify?token=${token}`;

  // Development fallback: log to console if no AWS credentials
  if (!sesClient) {
    console.log('\n========================================');
    console.log('[DEV MODE] Registration magic link generated!');
    console.log(`Email: ${email}`);
    console.log(`Verify URL: ${verifyUrl}`);
    console.log('========================================\n');
    return;
  }

  // Production: send via Amazon SES
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Verify your email for BASTION',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: registrationMagicLinkTemplate(verifyUrl),
          Charset: 'UTF-8'
        }
      }
    }
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send registration email via SES: ${message}`);
  }
}

/**
 * Sends a recovery email for users who lost their passkey.
 * In development mode (no AWS credentials), logs the link to console instead.
 */
export async function sendRecoveryEmail(email: string, token: string): Promise<void> {
  const recoveryUrl = `${APP_URL}/auth/recover/verify?token=${token}`;

  // Development fallback: log to console if no AWS credentials
  if (!sesClient) {
    console.log('\n========================================');
    console.log('[DEV MODE] Recovery link generated!');
    console.log(`Email: ${email}`);
    console.log(`Recovery URL: ${recoveryUrl}`);
    console.log('========================================\n');
    return;
  }

  // Production: send via Amazon SES
  const command = new SendEmailCommand({
    Source: FROM_EMAIL,
    Destination: {
      ToAddresses: [email]
    },
    Message: {
      Subject: {
        Data: 'Recover your BASTION account',
        Charset: 'UTF-8'
      },
      Body: {
        Html: {
          Data: recoveryEmailTemplate(recoveryUrl),
          Charset: 'UTF-8'
        }
      }
    }
  });

  try {
    await sesClient.send(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to send recovery email via SES: ${message}`);
  }
}
