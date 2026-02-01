/**
 * Magic link email templates for authentication.
 */

import { baseEmailTemplate, emailButton } from './base.js';

/**
 * Generates the login magic link email for returning users.
 *
 * @param verifyUrl - The URL for sign-in
 * @returns Complete HTML email string
 */
export function loginMagicLinkTemplate(verifyUrl: string): string {
  const preheader = 'Your sign-in link for BASTION';

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a365d;font-size:22px;font-weight:600;">
      Sign in to BASTION
    </h2>
    <p style="margin:0 0 8px 0;color:#4a5568;font-size:16px;line-height:1.6;">
      Click the button below to sign in to your account.
    </p>
    ${emailButton('Sign In', verifyUrl)}
    <p style="margin:0;color:#718096;font-size:14px;line-height:1.6;">
      This link expires in 15 minutes. If you didn't request this, you can safely ignore this email.
    </p>
  `;

  return baseEmailTemplate(content, preheader);
}

/**
 * Generates the registration verification email for new users.
 *
 * @param verifyUrl - The URL for email verification
 * @returns Complete HTML email string
 */
export function registrationMagicLinkTemplate(verifyUrl: string): string {
  const preheader = 'Verify your email for BASTION';

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a365d;font-size:22px;font-weight:600;">
      Verify your email
    </h2>
    <p style="margin:0 0 16px 0;color:#4a5568;font-size:16px;line-height:1.6;">
      Welcome to BASTION! Click the button below to verify your email address and complete your registration.
    </p>
    ${emailButton('Verify Email', verifyUrl)}
    <p style="margin:0;color:#718096;font-size:14px;line-height:1.6;">
      This link expires in 15 minutes. If you didn't create an account, you can safely ignore this email.
    </p>
  `;

  return baseEmailTemplate(content, preheader);
}
