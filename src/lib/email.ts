// src/lib/email.ts
// Helper email partagé : Resend en priorité, fallback log en dev.
// Utilisé par /api/admin/email (notifications) et /api/cron/* (rappels auto).

export interface EmailPayload {
  to: string;
  subject: string;
  body: string;       // texte brut, supporte **bold**
  html?: string;      // HTML optionnel — sinon converti depuis body
}

export interface EmailResult {
  provider: 'resend' | 'console';
  success: boolean;
  preview?: boolean;
  error?: string;
}

const markdownToHtml = (text: string): string =>
  text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

export async function sendEmail(payload: EmailPayload): Promise<EmailResult> {
  const { to, subject, body, html } = payload;

  // Option 1: Resend (gratuit jusqu'à 3000 emails/mois)
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM ?? 'B-Invest Limited <noreply@binvest.ng>',
          to: [to],
          subject,
          text: body,
          html: html ?? markdownToHtml(body),
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        return { provider: 'resend', success: false, error: errText };
      }
      return { provider: 'resend', success: true };
    } catch (err: any) {
      return { provider: 'resend', success: false, error: err?.message ?? String(err) };
    }
  }

  // Option 2: Pas de clé — log en dev, silencieux en prod
  if (process.env.NODE_ENV !== 'production') {
    console.log('[EMAIL PREVIEW]', {
      to, subject,
      bodyPreview: body.slice(0, 100) + (body.length > 100 ? '...' : ''),
    });
  }
  return { provider: 'console', success: true, preview: true };
}

/**
 * Envoi en lot avec compteur de réussite. Utile pour les crons.
 */
export async function sendEmailBatch(
  emails: EmailPayload[],
): Promise<{ sent: number; failed: number; errors: string[] }> {
  let sent = 0;
  let failed = 0;
  const errors: string[] = [];
  for (const e of emails) {
    const r = await sendEmail(e);
    if (r.success && !r.preview) sent++;
    else if (!r.success) {
      failed++;
      if (r.error) errors.push(`${e.to}: ${r.error}`);
    }
  }
  return { sent, failed, errors };
}
