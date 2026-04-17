// Quick email test script
import { Resend } from 'resend';

const RESEND_API_KEY = process.argv[2];
const TO_EMAIL = process.argv[3];

if (!RESEND_API_KEY) {
  console.error('Usage: node test-email.js <RESEND_API_KEY> [to@email]');
  process.exit(1);
}

if (!TO_EMAIL || TO_EMAIL === 'TO_EMAIL') {
  console.error('Please provide your email: node test-email.js <API_KEY> your@email.com');
  process.exit(1);
}

const resend = new Resend(RESEND_API_KEY);

console.log(`📧 Sending test email to: ${TO_EMAIL}`);

try {
  const result = await resend.emails.send({
    from: 'WinLab <noreply@winlab.cloud>',
    to: TO_EMAIL,
    subject: 'Test WinLab 🚀',
    html: `
      <div style="font-family: system-ui, sans-serif; max-width: 400px; margin: 0 auto; padding: 32px;">
        <div style="margin-bottom: 24px;">
          <span style="color: #3b82f6; font-weight: 900; font-size: 24px;">WIN</span>
          <span style="color: #fff; font-weight: 900; font-size: 24px;">LAB</span>
        </div>
        <h2 style="margin: 0 0 16px;">Funziona 🚀</h2>
        <p style="color: #94a3b8;">Email service configurato correttamente.</p>
        <p style="color: #94a3b8; font-size: 13px;">Timestamp: ${new Date().toISOString()}</p>
      </div>
    `,
  });

  console.log('✅ Email sent successfully!');
  console.log('Email ID:', result.data?.id);
} catch (err) {
  console.error('❌ Email failed:', err.message);
  process.exit(1);
}
