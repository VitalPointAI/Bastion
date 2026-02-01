/**
 * Base email template with branded layout for BASTION emails.
 *
 * Provides a consistent, professional email structure with:
 * - Dark blue header with application branding
 * - White content body area
 * - Gray footer with disclaimer
 * - Mobile-responsive design (max-width 600px)
 * - System fonts for email client compatibility
 */

/**
 * Generates a complete HTML email with branded layout.
 *
 * @param content - The main HTML content to display in the email body
 * @param preheader - Optional preview text shown in email clients before opening
 * @returns Complete HTML email string
 */
export function baseEmailTemplate(content: string, preheader?: string): string {
  const preheaderHtml = preheader
    ? `<div style="display:none;font-size:1px;color:#ffffff;line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;">${preheader}</div>`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>BASTION</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  ${preheaderHtml}
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:20px 10px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a365d;padding:24px 30px;text-align:center;border-radius:8px 8px 0 0;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;letter-spacing:0.5px;">
                BASTION
              </h1>
              <p style="margin:8px 0 0 0;color:#a0aec0;font-size:14px;font-weight:400;">
                Strategic Security & Resilience
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background-color:#ffffff;padding:40px 30px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f7fafc;padding:24px 30px;text-align:center;border-radius:0 0 8px 8px;border-top:1px solid #e2e8f0;">
              <p style="margin:0;color:#718096;font-size:12px;line-height:1.6;">
                This email was sent by BASTION.<br>
                If you didn't request this, you can safely ignore it.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Generates a styled CTA button for email templates.
 *
 * @param text - Button text
 * @param href - Button link URL
 * @returns HTML string for a styled button
 */
export function emailButton(text: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
  <tr>
    <td align="center">
      <a href="${href}" target="_blank" style="display:inline-block;background-color:#1a365d;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;padding:14px 32px;border-radius:6px;text-align:center;">
        ${text}
      </a>
    </td>
  </tr>
</table>`;
}
