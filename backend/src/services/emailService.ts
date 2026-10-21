
import nodemailer from 'nodemailer';

// ========================================
// GMAIL SMTP CONFIGURATION
// ========================================

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 465),
  secure: Number(process.env.SMTP_PORT || 465) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD,
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 15000,
});

// ========================================
// SEND FORGOT PASSWORD OTP
// ========================================

export async function sendPasswordResetOTP(
  email: string,
  otp: string
): Promise<void> {
  if (
    !process.env.SMTP_USER ||
    !process.env.SMTP_PASSWORD
  ) {
    throw new Error('SMTP credentials are not configured');
  }

  const fromEmail =
    process.env.SMTP_FROM || process.env.SMTP_USER;

  await transporter.sendMail({
    from: {
      name: 'Hariharipura Temple',
      address: fromEmail,
    },
    to: email,
    subject: 'Password Reset OTP - Hariharipura Temple',
    text: `Namaste,

Your Hariharipura Temple App password reset OTP is:

${otp}

This OTP is valid for 5 minutes.

If you did not request a password reset, please ignore this email.

Hariharipura Temple App`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;padding:24px;background:#fffdf8;">
        <h2 style="color:#6B1720;text-align:center;">
          Hariharipura Temple
        </h2>
        <p>Namaste,</p>
        <p>Use the following OTP to reset your Temple App password.</p>
        <div style="background:#f7ebd7;border-radius:12px;padding:22px;text-align:center;">
          <div style="font-size:32px;letter-spacing:8px;font-weight:bold;color:#6B1720;">
            ${otp}
          </div>
        </div>
        <p>This OTP is valid for <strong>5 minutes</strong>.</p>
        <p>If you did not request this reset, you can safely ignore this email.</p>
        <hr style="border:0;border-top:1px solid #e8dccb;margin-top:24px;"/>
        <p style="font-size:12px;color:#8e8175;text-align:center;">
          Hariharipura Temple App
        </p>
      </div>
    `,
  });
}

// ========================================
// VERIFY SMTP CONNECTION
// ========================================

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log('SMTP connection verified successfully');
    return true;
  } catch (error) {
    console.error('SMTP connection failed:', error);
    return false;
  }
}
