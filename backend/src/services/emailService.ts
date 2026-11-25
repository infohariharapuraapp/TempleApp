
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
    await response.body?.cancel();

    console.error(
      'Brevo password reset email delivery failed:',
      response.status
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

// ========================================
// ESCAPE HTML FOR EMAIL TEMPLATES
// ========================================

function escapeEmailHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ========================================
// SEND REGISTRATION CONFIRMATION EMAIL
// ========================================

export async function sendRegistrationConfirmation(
  email: string,
  fullName: string
): Promise<void> {

  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    throw new Error('BREVO_API_KEY is not configured');
  }

  const safeName = escapeEmailHtml(fullName);

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

      subject:
        'Welcome to Divyakshetra Hariharapura - Registration Successful',

      textContent: `Namaskaram ${fullName},

Your registration with the Divyakshetra Hariharapura Temple App has been completed successfully.

We warmly welcome you to our digital spiritual community.

You can now explore temple activities, upcoming events, Mahaswamiji's programmes, Pravachanas, Daily Panchangam and spiritual services.

May the divine blessings of Sri Lakshmi Narasimha Swamy and Sri Sharadamba be with you and your family.

With blessings,
Divyakshetra Hariharapura
Sree Math, Hariharapura

If you did not create this account, please contact the temple administration.

This is an automatically generated email.`,

      htmlContent: `
        <div style="
          font-family:Arial,sans-serif;
          background:#f5efe5;
          padding:24px 10px;
          color:#333333;
        ">

          <div style="
            max-width:600px;
            margin:auto;
            background:#fffdf8;
            border:1px solid #e4d3b5;
            border-radius:16px;
            overflow:hidden;
          ">

            <div style="
              background:#6B1720;
              padding:32px 20px;
              text-align:center;
              color:#ffffff;
            ">

              <div style="
                color:#E7C77A;
                font-size:28px;
                margin-bottom:12px;
              ">
                &#2384;
              </div>

              <h1 style="
                font-size:24px;
                margin:0;
                line-height:1.4;
              ">
                Divyakshetra Hariharapura
              </h1>

              <p style="
                color:#E7C77A;
                font-size:14px;
                margin-bottom:0;
              ">
                Sree Math, Hariharapura
              </p>

            </div>

            <div style="padding:28px 24px;">

              <div style="
                background:#f7ebd7;
                border:1px solid #dfc58b;
                border-radius:12px;
                padding:22px;
                text-align:center;
                margin-bottom:24px;
              ">

                <div style="
                  font-size:30px;
                  color:#287a43;
                ">
                  &#10003;
                </div>

                <h2 style="
                  color:#6B1720;
                  font-size:22px;
                  margin:12px 0 6px;
                ">
                  Registration Successful
                </h2>

                <p style="
                  color:#6f6254;
                  font-size:14px;
                  margin:0;
                ">
                  Welcome to our spiritual community
                </p>

              </div>

              <p style="font-size:16px;">
                Namaskaram <strong>${safeName}</strong>,
              </p>

              <p style="line-height:1.8;">
                Your registration with the
                <strong>Divyakshetra Hariharapura Temple App</strong>
                has been completed successfully.
              </p>

              <p style="line-height:1.8;">
                We warmly welcome you to our digital
                spiritual community.
              </p>

              <h3 style="color:#6B1720;">
                Explore our Temple App
              </h3>

              <ul style="
                line-height:2;
                padding-left:22px;
                color:#51463d;
              ">
                <li>Temple Activities and Events</li>
                <li>Mahaswamiji's Programmes</li>
                <li>Pravachanas and Guru Vani</li>
                <li>Daily Panchangam</li>
                <li>Darshan and Spiritual Services</li>
                <li>Divyakshetra Updates</li>
              </ul>

              <div style="
                border-top:1px solid #e4d3b5;
                border-bottom:1px solid #e4d3b5;
                padding:20px 12px;
                margin:24px 0;
                text-align:center;
                color:#6B1720;
                line-height:1.8;
              ">
                May the divine blessings of
                Sri Lakshmi Narasimha Swamy and
                Sri Sharadamba be with you and your family.
              </div>

              <p style="line-height:1.7;">
                With blessings,<br/>
                <strong>Divyakshetra Hariharapura</strong><br/>
                Sree Math, Hariharapura
              </p>

            </div>

            <div style="
              background:#f7ebd7;
              padding:20px;
              text-align:center;
              color:#8e8175;
              font-size:12px;
              line-height:1.7;
            ">
              If you did not create this account,
              please contact the temple administration.

              <br/><br/>

              This is an automatically generated email.

              <br/>

              Divyakshetra Hariharapura Temple App
            </div>

          </div>

        </div>
      `,
    }),

    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {

    console.error(
      'Registration email delivery failed:',
      response.status
    );

    throw new Error(
      `Brevo registration email failed (${response.status})`
    );
  }

  console.log(
    'Registration confirmation email accepted by Brevo'
  );
}