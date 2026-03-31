// @ts-nocheck
// src/app/api/admin/investors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

// Try to generate a signed URL from Supabase Storage.
// Returns null gracefully if the file doesn't exist.
async function signedUrl(supabase: any, bucket: string, path: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1h expiry
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch { return null; }
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data: investor, error: invErr } = await supabase
      .from('investors')
      .select('*')
      .eq('id', id)
      .single();

    if (invErr || !investor) {
      return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    }

    // Subscriptions with project info and tranches
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select(`
        *,
        project:projects(id, name, type, status, fee_facilitation_pct),
        tranches:payment_tranches(
          id, tranche_number, amount_ngn, status,
          received_amount_ngn, received_date, due_date,
          payment_method, bank_reference, notes
        )
      `)
      .eq('investor_id', id)
      .order('created_at', { ascending: false });

    const tranches = (subscriptions ?? []).flatMap(sub =>
      (sub.tranches ?? []).map((t: any) => ({
        ...t,
        subscription: {
          id: sub.id,
          dia_reference: sub.dia_reference,
          amount_ngn: sub.amount_ngn,
          total_amount_ngn: sub.total_amount_ngn,
          tranches_count: sub.tranches_count,
          project: sub.project,
        },
      }))
    );

    // ── KYC documents — try multiple field name conventions ─────────
    // Convention 1: direct public URLs already stored in investor row
    let kyc_docs = {
      id_front: investor.id_front_url ?? investor.id_document_front ?? investor.kyc_front_url ?? null,
      id_back:  investor.id_back_url  ?? investor.id_document_back  ?? investor.kyc_back_url  ?? null,
      selfie:   investor.selfie_url   ?? investor.kyc_selfie_url    ?? null,
    };

    // Convention 2: files stored in Supabase Storage bucket "kyc-documents"
    // Path pattern used by Buam Finance app: kyc/{user_id}/{filename}
    // We try both investor.id (admin panel UUID) and investor.user_id (auth UUID)
    const storageIds = [id, investor.user_id].filter(Boolean);
    for (const sid of storageIds) {
      if (!kyc_docs.id_front) {
        kyc_docs.id_front = await signedUrl(supabase, 'kyc-documents', `${sid}/id_front.jpg`)
          ?? await signedUrl(supabase, 'kyc-documents', `${sid}/id_front.png`)
          ?? await signedUrl(supabase, 'kyc-documents', `kyc/${sid}/id_front.jpg`)
          ?? await signedUrl(supabase, 'kyc', `${sid}/id_front.jpg`);
      }
      if (!kyc_docs.id_back) {
        kyc_docs.id_back = await signedUrl(supabase, 'kyc-documents', `${sid}/id_back.jpg`)
          ?? await signedUrl(supabase, 'kyc-documents', `${sid}/id_back.png`)
          ?? await signedUrl(supabase, 'kyc-documents', `kyc/${sid}/id_back.jpg`)
          ?? await signedUrl(supabase, 'kyc', `${sid}/id_back.jpg`);
      }
      if (!kyc_docs.selfie) {
        kyc_docs.selfie = await signedUrl(supabase, 'kyc-documents', `${sid}/selfie.jpg`)
          ?? await signedUrl(supabase, 'kyc-documents', `${sid}/selfie.png`)
          ?? await signedUrl(supabase, 'kyc-documents', `kyc/${sid}/selfie.jpg`)
          ?? await signedUrl(supabase, 'kyc', `${sid}/selfie.jpg`);
      }
    }

    return NextResponse.json({ investor, subscriptions: subscriptions ?? [], tranches, kyc_docs });
  } catch (err: any) {
    console.error('[INVESTORS GET ID]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const { data: old } = await supabase.from('investors').select('*').eq('id', id).single();

    const allowed = [
      'full_name', 'email', 'phone', 'country', 'nationality', 'address',
      'id_type', 'id_number', 'kyc_status', 'kyc_notes', 'kyc_rejection_reason',
      'pic_member', 'pic_fee_paid', 'dia_signed', 'dia_signed_date',
      'risk_profile', 'notes', 'is_active',
      'subscription_start_date', 'subscription_end_date', 'subscription_status',
      // user_id links the investor row to a Supabase Auth user (needed for mobile app RLS)
      'user_id',
      // KYC doc URLs (uploaded by mobile app)
      'id_front_url', 'id_back_url', 'selfie_url',
    ];
    const update: any = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('investors')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // Sync kyc_submissions table when KYC status changes (best-effort)
    if (update.kyc_status) {
      const kycSubUpdate: any = {
        status: update.kyc_status,
        reviewed_by: admin.email,
        reviewed_at: new Date().toISOString(),
      };
      if (update.kyc_rejection_reason) kycSubUpdate.rejection_reason = update.kyc_rejection_reason;

      // Match by investor_id or by user_id
      await Promise.allSettled([
        supabase.from('kyc_submissions').update(kycSubUpdate)
          .eq('investor_id', id).in('status', ['submitted', 'pending', 'in_review']),
        ...(data?.user_id ? [
          supabase.from('kyc_submissions').update(kycSubUpdate)
            .eq('user_id', data.user_id).in('status', ['submitted', 'pending', 'in_review']),
        ] : []),
        // Mark related notifications as read
        supabase.from('notifications').update({ is_read: true })
          .eq('type', 'kyc').eq('is_read', false)
          .eq('user_id', data?.user_id ?? ''),
      ]);
    }

    // Determine audit severity
    const severity = update.is_active === false ? 'warning'
      : update.kyc_status === 'approved' || update.kyc_status === 'rejected' ? 'warning'
      : 'info';

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: update.is_active === false ? 'investor.archive'
        : update.kyc_status ? `investor.kyc.${update.kyc_status}`
        : 'investor.update',
      resourceType: 'investor', resourceId: id,
      oldValues: old ?? undefined, newValues: update,
      ipAddress: admin.ip, severity,
    });

    return NextResponse.json({ investor: data });
  } catch (err: any) {
    console.error('[INVESTORS PUT]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (admin.role !== 'super_admin') {
    return NextResponse.json({ error: 'Super Admin requis' }, { status: 403 });
  }

  try {
    const supabase = createAdminClient();
    const { data: old } = await supabase.from('investors').select('full_name, email').eq('id', id).single();
    const { error } = await supabase.from('investors').delete().eq('id', id);
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'investor.delete', resourceType: 'investor', resourceId: id,
      oldValues: old ?? undefined,
      ipAddress: admin.ip, severity: 'critical',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[INVESTORS DELETE]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
