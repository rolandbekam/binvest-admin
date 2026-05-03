// @ts-nocheck
// src/app/api/cron/payment-reminders/route.ts
// Rappels avant échéance de tranche B-Invest (J-7, J-3, J-1).
// À déclencher quotidiennement (08:00) via Vercel Cron.
//   vercel.json : "crons":[{"path":"/api/cron/payment-reminders","schedule":"0 8 * * *"}]

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { sendEmail } from '@/lib/email';
import { sendPushToUser } from '@/lib/pushNotifications';

const REMINDER_DAYS = [7, 3, 1];

function nextDueDateForDays(days: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  // Protection cron (header ou query string)
  const secret =
    request.headers.get('x-cron-secret') ??
    request.nextUrl.searchParams.get('secret');
  if (process.env.CRON_SECRET && secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = {
    emails_sent: 0,
    push_sent: 0,
    skipped: 0,
    errors: [] as string[],
  };

  try {
    const supabase = createAdminClient();

    for (const days of REMINDER_DAYS) {
      const targetDate = nextDueDateForDays(days);

      // Souscriptions actives dont prochaine tranche tombe ce jour-là
      const { data: subs, error: subErr } = await supabase
        .from('subscriptions')
        .select('id, user_id, project_name, total_amount, tranches_paid, tranches_total, next_due_date')
        .eq('status', 'active')
        .eq('next_due_date', targetDate);

      if (subErr) {
        results.errors.push(`day=${days}: ${subErr.message}`);
        continue;
      }
      if (!subs || subs.length === 0) continue;

      for (const sub of subs) {
        if (!sub.user_id) { results.skipped++; continue; }

        // Lookup investor pour email
        const { data: investor } = await supabase
          .from('investors')
          .select('full_name, email')
          .eq('user_id', sub.user_id)
          .maybeSingle();

        const trancheAmount = Math.round(sub.total_amount / sub.tranches_total);
        const trancheNum = sub.tranches_paid + 1;
        const dateFmt = new Date(sub.next_due_date).toLocaleDateString('fr-FR');

        // Push notification (silencieux si pas de token)
        const pushOk = await sendPushToUser(sub.user_id, {
          title: `🔔 Tranche ${trancheNum} dans ${days}j`,
          body: `${sub.project_name} — ${trancheAmount.toLocaleString('fr-FR')} FCFA dus le ${dateFmt}`,
          data: { type: 'binvest_reminder', subscription_id: sub.id },
        });
        if (pushOk) results.push_sent++;

        // Email (si on a une adresse)
        if (investor?.email) {
          const r = await sendEmail({
            to: investor.email,
            subject: `Rappel B-Invest — Tranche ${trancheNum} dans ${days} jour(s)`,
            body: `Bonjour ${investor.full_name ?? ''},

Votre tranche ${trancheNum}/${sub.tranches_total} pour le projet **${sub.project_name}** arrive à échéance le **${dateFmt}** (dans ${days} jour${days > 1 ? 's' : ''}).

**Montant à régler :** ${trancheAmount.toLocaleString('fr-FR')} FCFA

Pour effectuer votre paiement, connectez-vous à l'app Buam Finance > B-Invest > Vos souscriptions.

Cordialement,
**L'équipe B-Invest Limited**`,
          });
          if (r.success && !r.preview) results.emails_sent++;
          else if (!r.success && r.error) results.errors.push(`sub=${sub.id}: ${r.error}`);
        } else {
          results.skipped++;
        }
      }
    }

    return NextResponse.json({ success: true, ...results, run_at: new Date().toISOString() });
  } catch (err: any) {
    console.error('[CRON payment-reminders]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
