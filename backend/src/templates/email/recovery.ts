/**
 * Recovery email template for account recovery.
 */

import { baseEmailTemplate, emailButton } from './base.js';

/**
 * Generates the account recovery email.
 *
 * @param recoveryUrl - The URL for account recovery verification
 * @returns Complete HTML email string
 */
export function recoveryEmailTemplate(recoveryUrl: string): string {
  const preheader = 'Recover access to your BASTION account';

  const content = `
    <h2 style="margin:0 0 16px 0;color:#1a365d;font-size:22px;font-weight:600;">
      Account Recovery
    </h2>
    <p style="margin:0 0 16px 0;color:#4a5568;font-size:16px;line-height:1.6;">
      We received a request to help you regain access to your BASTION account. Click below to verify your identity and set up a new passkey.
    </p>
    ${emailButton('Recover Account', recoveryUrl)}
    <p style="margin:0;color:#718096;font-size:14px;line-height:1.6;">
      This link expires in 15 minutes. If you didn't request this, your account is secure - someone may have entered your email by mistake.
    </p>
  `;

  return baseEmailTemplate(content, preheader);
}
