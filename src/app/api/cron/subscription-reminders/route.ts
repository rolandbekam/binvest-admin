// @ts-nocheck
// src/app/api/cron/subscription-reminders/route.ts
// Called by Vercel Cron or an external scheduler (daily at 08:00)
// Add to vercel.json:
//   "crons": [{ "path": "/api/cron/subscription-reminders", "schedule": "0 8 * * *" }]
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';

const REMINDER_DAYS = [60, 30, 14, 7];
const PIC_FEE_AMOUNT = 50_000;

async function sendEmail(to: string, subject: string, body: string) {
  // TODO: replace with actual SMTP / Resend / SendGrid integration
  console.log(`[CRON EMAIL] To: ${to}\nSubject: ${subject}\n${body}\n`);
}

export async function GET(request: NextRequest) {
  // Protect endpoint with CRON_SECRET env var
  const secret =
    request.headers.get('x-cron-secret') ??
    request.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createAdminClient();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    const results = { expired: 0, reminders_sent: 0, errors: [] as string[] };

    // ── 1. Mark expired subscriptions ────────────────────────────
    const { data: expired, error: expErr } = await supabase
      .from('investors')
      .update({ subscription_status: 'expired' })
      .eq('subscription_status', 'active')
      .lt('subscription_end_date', todayStr)
      .select('id, full_name, email');

    if (expErr) {
      results.errors.push(`expire: ${expErr.message}`);
    } else if (expired && expired.length > 0) {
      results.expired = expired.length;
      for (const inv of expired) {
        await sendEmail(
          inv.email,
          'Abonnement B-Invest expiré — Renouvellement requis',
          `Bonjour ${inv.full_name},\n\nVotre abonnement annuel B-Invest a expiré ce jour.\nVotre accès aux projets est suspendu jusqu\'au renouvellement.\n\nPour renouveler votre adhésion, contactez l\'équipe B-Invest et réglez votre cotisation de ${PIC_FEE_AMOUNT.toLocaleString('fr-FR')} FCFA.\n\nCordialement,\nL\'équipe B-Invest Limited`
        );
      }
    }

    // ── 2. Send upcoming-expiry reminders ─────────────────────────
    for (const days of REMINDER_DAYS) {
      const targetDate = new Date(today);
      targetDate.setDate(targetDate.getDate() + days);
      const targetStr = targetDate.toISOString().split('T')[0];

      const { data: investors } = await supabase
        .from('investors')
        .select('id, full_name, email, subscription_end_date')
        .eq('subscription_status', 'active')
        .eq('subscription_end_date', targetStr);

      if (!investors || investors.length === 0) continue;

      for (const inv of investors) {
        // Skip if already sent
        const { data: alreadySent } = await supabase
          .from('subscription_reminders')
          .select('id')
          .eq('investor_id', inv.id)
          .eq('days_before', days)
          .eq('subscription_end_date', inv.subscription_end_date)
          .maybeSingle();

        if (alreadySent) continue;

        const expiryFormatted = new Date(inv.subscription_end_date).toLocaleDateString('fr-FR');

        await sendEmail(
          inv.email,
          `Rappel B-Invest — Votre abonnement expire dans ${days} jours`,
          `Bonjour ${inv.full_name},\n\nVotre abonnement B-Invest expire le ${expiryFormatted} (dans ${days} jours).\n\nPour renouveler votre accès sans interruption, contactez l\'équipe B-Invest et réglez votre cotisation de ${PIC_FEE_AMOUNT.toLocaleString('fr-FR')} FCFA.\n\nCordialement,\nL\'équipe B-Invest Limited`
        );

        await supabase.from('subscription_reminders').insert({
          investor_id: inv.id,
          days_before: days,
          subscription_end_date: inv.subscription_end_date,
        });

        results.reminders_sent++;
      }
    }

    console.log('[CRON subscription-reminders]', results);
    return NextResponse.json({ success: true, ...results, run_at: new Date().toISOString() });
  } catch (err: any) {
    console.error('[CRON] Fatal error:', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
