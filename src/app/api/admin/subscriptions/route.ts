// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project_id');
    const investorId = searchParams.get('investor_id');

    let query = supabase
      .from('subscriptions')
      .select(`*, investor:investors(id, full_name, email, country), project:projects(id, name, type), tranches:payment_tranches(id,tranche_number,amount_ngn,status,received_amount_ngn,received_date,due_date)`)
      .order('created_at', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (investorId) query = query.eq('investor_id', investorId);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ subscriptions: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const { investor_id, project_id, amount_ngn, tranches_count = 1 } = body;

    if (!investor_id || !project_id || !amount_ngn) {
      return NextResponse.json({ error: 'investor_id, project_id et amount_ngn sont obligatoires' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── KYC check ───────────────────────────────────────────────────
    const { data: investor, error: invErr } = await supabase
      .from('investors')
      .select('id, full_name, email, kyc_status')
      .eq('id', investor_id)
      .single();

    if (invErr || !investor) {
      return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    }

    if (investor.kyc_status !== 'approved') {
      // Send KYC pending notification email
      if (investor.email) {
        const lang = body.lang ?? 'fr';
        const subject = lang === 'fr'
          ? '⚠️ Souscription en attente — KYC non validé'
          : '⚠️ Subscription pending — KYC not validated';
        const emailBody = lang === 'fr'
          ? `Bonjour ${investor.full_name},\n\nVotre souscription au projet est en attente de traitement car votre KYC (vérification d'identité) n'est pas encore validé.\n\nStatut actuel : ${investor.kyc_status}\n\nVeuillez fournir vos documents d'identité à l'équipe B-Invest pour accélérer la validation.\n\nL'équipe B-Invest Limited`
          : `Hello ${investor.full_name},\n\nYour project subscription is pending processing because your KYC (identity verification) has not been validated yet.\n\nCurrent status: ${investor.kyc_status}\n\nPlease provide your identity documents to the B-Invest team to accelerate validation.\n\nThe B-Invest Limited Team`;

        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/admin/email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-id': admin.id, 'x-admin-role': admin.role, 'x-admin-email': admin.email, 'x-client-ip': admin.ip ?? '' },
          body: JSON.stringify({ type: 'custom', to_email: investor.email, to_name: investor.full_name, custom_subject: subject, custom_body: emailBody }),
        }).catch(() => {});
      }

      return NextResponse.json({
        error: `KYC non validé (statut: ${investor.kyc_status}). Un email a été envoyé à l'investisseur.`,
        kyc_status: investor.kyc_status,
      }, { status: 422 });
    }

    // ── Project check ────────────────────────────────────────────────
    const { data: project, error: projErr } = await supabase
      .from('projects')
      .select('id, name, status, spots_total, spots_taken, max_amount_ngn, raised_amount_ngn, close_date, fee_facilitation_pct')
      .eq('id', project_id)
      .single();

    if (projErr || !project) {
      return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    }

    if (!['open', 'active'].includes(project.status)) {
      return NextResponse.json({ error: `Projet non ouvert aux souscriptions (statut: ${project.status})` }, { status: 422 });
    }

    if (project.spots_total && (project.spots_taken ?? 0) >= project.spots_total) {
      return NextResponse.json({ error: 'Nombre maximum d\'investisseurs atteint' }, { status: 422 });
    }

    if (project.close_date && new Date(project.close_date) < new Date()) {
      return NextResponse.json({ error: 'Date limite de souscription dépassée' }, { status: 422 });
    }

    // ── Create subscription ─────────────────────────────────────────
    const fee_pct = project.fee_facilitation_pct ?? 10;
    const facilitation_fee_ngn = Math.round(amount_ngn * fee_pct / 100);
    const total_amount_ngn = amount_ngn + facilitation_fee_ngn;
    const diaRef = `DIA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2,10).toUpperCase()}`;

    const { data: subscription, error: subErr } = await supabase
      .from('subscriptions')
      .insert({
        investor_id,
        project_id,
        amount_ngn,
        facilitation_fee_ngn,
        total_amount_ngn,
        tranches_count,
        dia_reference: diaRef,
        status: 'active',
      })
      .select()
      .single();

    if (subErr) throw subErr;

    // ── Create payment tranches ──────────────────────────────────────
    const trancheAmount = Math.round(total_amount_ngn / tranches_count);
    const trancheInserts = Array.from({ length: tranches_count }, (_, i) => ({
      subscription_id: subscription.id,
      tranche_number: i + 1,
      amount_ngn: i === tranches_count - 1 ? total_amount_ngn - trancheAmount * (tranches_count - 1) : trancheAmount,
      status: 'pending',
    }));

    await supabase.from('payment_tranches').insert(trancheInserts);

    // ── Update spots_taken ───────────────────────────────────────────
    await supabase.from('projects').update({ spots_taken: (project.spots_taken ?? 0) + 1 }).eq('id', project_id);

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'subscription.create', resourceType: 'subscription', resourceId: subscription.id,
      newValues: { investor_id, project_id, amount_ngn, tranches_count, dia_reference: diaRef },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ subscription, dia_reference: diaRef }, { status: 201 });
  } catch (err: any) {
    console.error('[SUBSCRIPTIONS POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
