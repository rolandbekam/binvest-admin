// @ts-nocheck
// src/app/api/admin/notifications/route.ts
// Unified notifications endpoint — KYC pending, payments pending, investors in review

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

// ── GET — fetch all actionable notifications ─────────────────────
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    // Investors with kyc_status = 'in_review' (submitted from mobile app, waiting admin validation)
    const { data: investorsReview, error: kycErr } = await supabase
      .from('investors')
      .select('id, full_name, email, country, kyc_status, created_at, updated_at, id_front_url, id_back_url, selfie_url, user_id')
      .eq('kyc_status', 'in_review')
      .order('updated_at', { ascending: false });

    if (kycErr && kycErr.code !== '42P01') throw kycErr;

    // Payment requests submitted from mobile app, awaiting admin confirmation
    const { data: paymentPending, error: payErr } = await supabase
      .from('payment_requests')
      .select(`
        *,
        subscription:subscriptions(
          id, dia_reference,
          investor:investors(id, full_name, email),
          project:projects(id, name, type)
        )
      `)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true });

    if (payErr && payErr.code !== '42P01') throw payErr;

    const kyc_pending = investorsReview ?? [];
    const payment_pending = paymentPending ?? [];

    return NextResponse.json({
      kyc_pending,
      payment_pending,
      investors_review: kyc_pending,  // same data, aliased for clarity
      counts: {
        kyc: kyc_pending.length,
        payments: payment_pending.length,
        total: kyc_pending.length + payment_pending.length,
      },
    });
  } catch (err: any) {
    console.error('[NOTIFICATIONS GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST — validate or reject a KYC (with optional email) ─────────
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const { investor_id, action, rejection_reason, send_email = true } = body;

    if (!investor_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'investor_id et action (approve|reject) requis' }, { status: 400 });
    }
    if (action === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json({ error: 'La raison du rejet est obligatoire' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch investor
    const { data: investor, error: fetchErr } = await supabase
      .from('investors')
      .select('id, full_name, email, kyc_status')
      .eq('id', investor_id)
      .single();

    if (fetchErr || !investor) {
      return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';
    const updatePayload: any = {
      kyc_status: newStatus,
      kyc_reviewed_by: admin.email,
      kyc_reviewed_at: new Date().toISOString(),
    };
    if (action === 'reject') {
      updatePayload.kyc_rejection_reason = rejection_reason;
    }

    const { error: updateErr } = await supabase
      .from('investors')
      .update(updatePayload)
      .eq('id', investor_id);

    if (updateErr) throw updateErr;

    // Send email notification if requested
    if (send_email && investor.email) {
      try {
        await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/api/admin/email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // Pass admin credentials for server-to-server call
            'x-admin-id': admin.id,
            'x-admin-email': admin.email,
            'x-admin-role': admin.role ?? 'admin',
          },
          body: JSON.stringify({
            type: action === 'approve' ? 'kyc_approved' : 'kyc_rejected',
            investor_id,
            variables: {
              name: investor.full_name,
              reason: rejection_reason ?? '',
              lang: 'fr',
            },
          }),
        });
      } catch (emailErr) {
        // Email failure is non-blocking
        console.warn('[NOTIFICATIONS] Email send failed (non-blocking):', emailErr);
      }
    }

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: `investor.kyc.${action}`,
      resourceType: 'investor', resourceId: investor_id,
      oldValues: { kyc_status: investor.kyc_status },
      newValues: { kyc_status: newStatus, rejection_reason: rejection_reason ?? null },
      ipAddress: admin.ip, severity: 'warning',
    });

    return NextResponse.json({
      success: true,
      action,
      investor_id,
      kyc_status: newStatus,
    });
  } catch (err: any) {
    console.error('[NOTIFICATIONS POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
