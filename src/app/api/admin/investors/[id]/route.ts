// @ts-nocheck
// src/app/api/admin/investors/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    // Investor details
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

    // Flatten tranches for payment history view
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

    return NextResponse.json({ investor, subscriptions: subscriptions ?? [], tranches });
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
      'id_type', 'id_number', 'kyc_status', 'kyc_notes',
      'pic_member', 'pic_fee_paid', 'dia_signed', 'dia_signed_date',
      'risk_profile', 'notes', 'is_active',
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

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'investor.update', resourceType: 'investor', resourceId: id,
      oldValues: old ?? undefined, newValues: update,
      ipAddress: admin.ip, severity: 'info',
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
