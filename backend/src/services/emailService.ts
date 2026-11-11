
const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

const SENDER_EMAIL =
  process.env.BREVO_SENDER_EMAIL ||
  'info.hariharapura@gmail.com';

const SENDER_NAME = 'Divyakshetra Hariharapura';

// ========================================
// SEND PASSWORD RESET OTP
// ========================================

export async function sendPasswordResetOTP(
  email: string,
  otp: string
): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const response = await fetch(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: SENDER_NAME,
        email: SENDER_EMAIL,
      },
      to: [{ email }],
      subject: 'Password Reset OTP - Divyakshetra Hariharapura',
      textContent: `Namaste,

Your Divyakshetra Hariharapura Temple App password reset OTP is:

${otp}

This OTP is valid for 5 minutes.

If you did not request a password reset, please ignore this email.

Divyakshetra Hariharapura`,
      htmlContent: `
        <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#fffdf8;color:#333;">
          <h2 style="color:#6B1720;text-align:center;">
            Divyakshetra Hariharapura
          </h2>

          <p>Namaste,</p>

          <p>
            We received a request to reset your Temple App password.
            Use the OTP below to continue.
          </p>

          <div style="background:#f7ebd7;border-radius:12px;padding:24px;text-align:center;margin:24px 0;">
            <div style="font-size:34px;letter-spacing:8px;font-weight:bold;color:#6B1720;">
              ${otp}
            </div>
          </div>

          <p>
            This OTP is valid for <strong>5 minutes</strong>.
          </p>

          <p>
            If you did not request this reset, please ignore this email.
          </p>

          <hr style="border:0;border-top:1px solid #e8dccb;margin-top:24px;" />

          <p style="font-size:12px;color:#8e8175;text-align:center;">
            Divyakshetra Hariharapura Temple App
          </p>
        </div>
      `,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    const errorText = await response.text();

    console.error(
      'Brevo email delivery failed:',
      response.status,
      errorText
    );

    throw new Error(
      `Brevo API request failed (${response.status})`
    );
  }

  console.log('Password reset email accepted by Brevo');
}

// ========================================
// CHECK EMAIL SERVICE CONFIGURATION
// ========================================

export async function verifyEmailConnection(): Promise<boolean> {
  if (!process.env.BREVO_API_KEY) {
    console.error('BREVO_API_KEY is not configured');
    return false;
  }

  console.log('Brevo API key is configured');
  return true;
}
