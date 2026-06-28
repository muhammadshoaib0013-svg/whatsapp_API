import { Resend } from 'resend';

const resendApiKey = process.env.RESEND_API_KEY;

if (!resendApiKey) {
  throw new Error('RESEND_API_KEY environment variable is not set');
}

const resend = new Resend(resendApiKey);

export async function sendVerificationEmail(email: string, code: string) {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: email,
      subject: 'Your WhatsApp SaaS Verification Code',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Verify Your Email</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #f9fafb;
                border-radius: 8px;
                padding: 40px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
              }
              .code {
                background: #1f2937;
                color: white;
                font-size: 32px;
                font-weight: bold;
                letter-spacing: 8px;
                padding: 20px 30px;
                border-radius: 8px;
                text-align: center;
                margin: 30px 0;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">WhatsApp Automation SaaS</div>
              </div>
              <h1>Verify Your Email Address</h1>
              <p>Thank you for signing up! Please use the verification code below to verify your email address:</p>
              <div class="code">${code}</div>
              <p>This code will expire in 15 minutes. If you didn't request this verification, you can safely ignore this email.</p>
              <div class="footer">
                <p>&copy; 2024 WhatsApp Automation SaaS. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
    console.log('[RESEND_RESPONSE]', data);
  } catch (error) {
    console.error('[RESEND_ERROR]', error);
    throw new Error('Failed to send verification email');
  }
}

export async function sendPasswordResetEmail(email: string, resetLink: string) {
  try {
    await resend.emails.send({
      from: 'WhatsApp Automation SaaS <noreply@yourdomain.com>',
      to: email,
      subject: 'Reset Your Password',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reset Your Password</title>
            <style>
              body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                line-height: 1.6;
                color: #333;
                max-width: 600px;
                margin: 0 auto;
                padding: 20px;
              }
              .container {
                background: #f9fafb;
                border-radius: 8px;
                padding: 40px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
              }
              .logo {
                font-size: 24px;
                font-weight: bold;
                color: #1f2937;
              }
              .button {
                display: inline-block;
                background: #2563eb;
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 6px;
                font-weight: 600;
                margin: 30px 0;
              }
              .footer {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #e5e7eb;
                text-align: center;
                color: #6b7280;
                font-size: 14px;
              }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <div class="logo">WhatsApp Automation SaaS</div>
              </div>
              <h1>Reset Your Password</h1>
              <p>We received a request to reset your password. Click the button below to create a new password:</p>
              <div style="text-align: center;">
                <a href="${resetLink}" class="button">Reset Password</a>
              </div>
              <p>This link will expire in 1 hour. If you didn't request this password reset, you can safely ignore this email.</p>
              <div class="footer">
                <p>&copy; 2024 WhatsApp Automation SaaS. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
    });
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    throw new Error('Failed to send password reset email');
  }
}
