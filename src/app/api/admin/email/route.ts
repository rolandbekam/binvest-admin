// src/app/api/admin/email/route.ts
// Notifications email automatiques via SMTP ou Resend

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';
import { z } from 'zod';

const EmailSchema = z.object({
  type: z.enum(['payment_received', 'reminder', 'welcome', 'kyc_approved', 'kyc_rejected', 'custom']),
  investor_id: z.string().uuid().optional(),
  to_email: z.string().email().optional(),
  to_name: z.string().optional(),
  variables: z.record(z.string()).optional(),
  custom_subject: z.string().optional(),
  custom_body: z.string().optional(),
});

// Templates email
const TEMPLATES: Record<string, any> = {
  payment_received: {
    subject_fr: '✅ Paiement reçu — B-Invest Limited',
    subject_en: '✅ Payment received — B-Invest Limited',
    body_fr: (v: Record<string,string>) => `
Bonjour ${v.name},

Nous confirmons la réception de votre paiement de **${v.amount}** pour le projet **${v.project}** (Tranche ${v.tranche}).

📋 Référence DIA : ${v.dia_reference}
📅 Date de réception : ${v.date}
💰 Montant reçu : ${v.amount}

Un accusé de réception officiel est joint à cet email.

Merci pour votre confiance,
**L'équipe B-Invest Limited**
    `.trim(),
    body_en: (v: Record<string,string>) => `
Hello ${v.name},

We confirm receipt of your payment of **${v.amount}** for project **${v.project}** (Instalment ${v.tranche}).

📋 DIA Reference: ${v.dia_reference}
📅 Date received: ${v.date}
💰 Amount received: ${v.amount}

An official acknowledgement is attached to this email.

Thank you for your trust,
**The B-Invest Limited Team**
    `.trim(),
  },
  reminder: {
    subject_fr: '⏰ Rappel de paiement — B-Invest Limited',
    subject_en: '⏰ Payment reminder — B-Invest Limited',
    body_fr: (v: Record<string,string>) => `
Bonjour ${v.name},

Ceci est un rappel pour votre tranche **${v.tranche}** de **${v.amount}** pour le projet **${v.project}**.

📅 Date d'échéance : **${v.due_date}**

Merci d'effectuer votre virement avant cette date pour éviter tout retard.

Coordonnées bancaires B-Invest :
- Banque : ${v.bank_name || 'Voir votre contrat DIA'}
- Référence : ${v.dia_reference}

L'équipe B-Invest Limited
    `.trim(),
    body_en: (v: Record<string,string>) => `
Hello ${v.name},

This is a reminder for your instalment **${v.tranche}** of **${v.amount}** for project **${v.project}**.

📅 Due date: **${v.due_date}**

Please proceed with your transfer before this date to avoid any delays.

B-Invest bank details:
- Reference: ${v.dia_reference}

The B-Invest Limited Team
    `.trim(),
  },
  welcome: {
    subject_fr: '🎉 Bienvenue chez B-Invest Limited !',
    subject_en: '🎉 Welcome to B-Invest Limited!',
    body_fr: (v: Record<string,string>) => `
Bonjour ${v.name},

Bienvenue dans la famille B-Invest Limited ! 🎉

Votre profil investisseur est maintenant actif. Vous pouvez :

📱 **Télécharger l'application Buam Finance** pour suivre vos investissements en temps réel
📋 **Consulter vos projets** et l'avancement de vos souscriptions
💰 **Suivre vos paiements** et accusés de réception DIA

Pour toute question, contactez notre équipe à contact@binvest.ng

Cordialement,
**Raissa Bekamba**
Fondatrice & CEO — B-Invest Limited
    `.trim(),
    body_en: (v: Record<string,string>) => `
Hello ${v.name},

Welcome to the B-Invest Limited family! 🎉

Your investor profile is now active. You can:

📱 **Download the Buam Finance app** to track your investments in real time
📋 **View your projects** and subscription progress
💰 **Track your payments** and DIA acknowledgements

For any questions, contact our team at contact@binvest.ng

Best regards,
**Raissa Bekamba**
Founder & CEO — B-Invest Limited
    `.trim(),
  },
  kyc_approved: {
    subject_fr: '✅ Votre KYC a été validé — B-Invest Limited',
    subject_en: '✅ Your KYC has been approved — B-Invest Limited',
    body_fr: (v: Record<string,string>) => `
Bonjour ${v.name},

Excellente nouvelle ! 🎉 Votre vérification d'identité (KYC) a été **validée** par notre équipe.

Vous pouvez désormais :
📱 Accéder à toutes les fonctionnalités de l'application Buam Finance
💼 Souscrire aux projets d'investissement B-Invest
📋 Consulter et signer votre contrat DIA

Bienvenue dans la communauté d'investisseurs B-Invest !

Cordialement,
**L'équipe B-Invest Limited**
    `.trim(),
    body_en: (v: Record<string,string>) => `
Hello ${v.name},

Great news! 🎉 Your identity verification (KYC) has been **approved** by our team.

You can now:
📱 Access all features of the Buam Finance app
💼 Subscribe to B-Invest investment projects
📋 View and sign your DIA contract

Welcome to the B-Invest investor community!

Best regards,
**The B-Invest Limited Team**
    `.trim(),
  },
  kyc_rejected: {
    subject_fr: '⚠️ Vérification KYC — Action requise — B-Invest Limited',
    subject_en: '⚠️ KYC Verification — Action required — B-Invest Limited',
    body_fr: (v: Record<string,string>) => `
Bonjour ${v.name},

Nous avons examiné votre dossier KYC et nous ne sommes malheureusement pas en mesure de le valider pour le moment.

**Motif du rejet :**
${v.reason}

**Comment procéder :**
1. Connectez-vous à l'application Buam Finance
2. Accédez à votre profil → Section KYC
3. Soumettez à nouveau vos documents en tenant compte du motif indiqué ci-dessus

Si vous avez des questions, contactez notre équipe à contact@binvest.ng

Cordialement,
**L'équipe B-Invest Limited**
    `.trim(),
    body_en: (v: Record<string,string>) => `
Hello ${v.name},

We have reviewed your KYC application and unfortunately are unable to validate it at this time.

**Reason for rejection:**
${v.reason}

**What to do next:**
1. Open the Buam Finance app
2. Go to your profile → KYC section
3. Resubmit your documents addressing the reason mentioned above

If you have any questions, contact our team at contact@binvest.ng

Best regards,
**The B-Invest Limited Team**
    `.trim(),
  },
};  // end TEMPLATES

async function sendEmail({ to, subject, body, html }: { to: string; subject: string; body: string; html?: string }) {
  // Option 1: Resend (recommandé — gratuit jusqu'à 3000/mois)
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (RESEND_KEY) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM ?? 'B-Invest Limited <noreply@binvest.ng>',
        to: [to],
        subject,
        text: body,
        html: html ?? body.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>'),
      }),
    });
    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);
    return { provider: 'resend', success: true };
  }

  // Option 2: Log en développement (pas de clé email configurée)
  console.log('[EMAIL PREVIEW]', { to, subject, body });
  return { provider: 'console', success: true, preview: true };
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = EmailSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides' }, { status: 400 });

    const { type, investor_id, to_email, to_name, variables = {}, custom_subject, custom_body } = parsed.data;
    const supabase = createAdminClient();

    let email = to_email;
    let name = to_name ?? 'Investisseur';

    // Récupérer l'investisseur si ID fourni
    if (investor_id) {
      const { data: inv } = await supabase.from('investors').select('full_name, email').eq('id', investor_id).single();
      if (inv) { email = inv.email; name = inv.full_name; }
    }

    if (!email) return NextResponse.json({ error: 'Email destinataire requis' }, { status: 400 });

    const lang = variables.lang ?? 'fr';
    const vars = { name, ...variables };

    let subject: string;
    let emailBody: string;

    if (type === 'custom') {
      subject = custom_subject ?? 'Message de B-Invest Limited';
      emailBody = custom_body ?? '';
    } else {
      const tmpl = TEMPLATES[type];
      subject = lang === 'fr' ? tmpl.subject_fr : tmpl.subject_en;
      emailBody = lang === 'fr' ? tmpl.body_fr(vars) : tmpl.body_en(vars);
    }

    const result = await sendEmail({ to: email, subject, body: emailBody });

    // Audit
    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: `email.send.${type}`, resourceType: 'email',
      newValues: { to: email, type, preview: (result as any).preview ?? false },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({
      success: true,
      to: email,
      subject,
      provider: result.provider,
      preview: (result as any).preview ?? false,
    });

  } catch (err: any) {
    console.error('[EMAIL]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur envoi email' }, { status: 500 });
  }
}
