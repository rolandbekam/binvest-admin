// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

const PIC_FEE_XAF = 50000;

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    // All investors with pic_member = true, ordered by join date
    const { data: members, error } = await supabase
      .from('investors')
      .select('id, full_name, email, phone, country, kyc_status, pic_member, pic_fee_paid, pic_joined_at, created_at, notes')
      .eq('pic_member', true)
      .order('pic_joined_at', { ascending: false, nullsFirst: true });

    if (error) throw error;

    const list = members ?? [];
    const stats = {
      total_members: list.length,
      fees_paid_count: list.filter(m => m.pic_fee_paid).length,
      fees_pending_count: list.filter(m => !m.pic_fee_paid).length,
      total_fees_xaf: list.filter(m => m.pic_fee_paid).length * PIC_FEE_XAF,
    };

    return NextResponse.json({ members: list, stats });
  } catch (err: any) {
    console.error('[PIC GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const { investor_id, action } = body;

    if (!investor_id || !['validate_pic', 'record_fee', 'revoke_pic'].includes(action)) {
      return NextResponse.json({ error: 'investor_id et action valide requis' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: investor } = await supabase.from('investors').select('*').eq('id', investor_id).single();
    if (!investor) return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });

    let update: any = {};
    let auditAction = '';

    if (action === 'validate_pic') {
      if (investor.kyc_status !== 'approved') {
        return NextResponse.json({ error: 'KYC doit être approuvé avant de valider l\'adhésion PIC' }, { status: 422 });
      }
      update = { pic_member: true, pic_joined_at: new Date().toISOString() };
      auditAction = 'pic.validate';
    } else if (action === 'record_fee') {
      update = { pic_fee_paid: true };
      auditAction = 'pic.fee_recorded';
    } else if (action === 'revoke_pic') {
      update = { pic_member: false, pic_fee_paid: false };
      auditAction = 'pic.revoke';
    }

    const { data: updated, error } = await supabase
      .from('investors')
      .update(update)
      .eq('id', investor_id)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: auditAction, resourceType: 'investor', resourceId: investor_id,
      oldValues: investor, newValues: update,
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ investor: updated });
  } catch (err: any) {
    console.error('[PIC PATCH]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// Add a non-PIC investor to PIC
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const { investor_id } = await request.json();
    if (!investor_id) return NextResponse.json({ error: 'investor_id requis' }, { status: 400 });

    const supabase = createAdminClient();
    const { data: investor } = await supabase.from('investors').select('*').eq('id', investor_id).single();
    if (!investor) return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    if (investor.kyc_status !== 'approved') {
      return NextResponse.json({ error: 'KYC doit être approuvé' }, { status: 422 });
    }

    const { data: updated, error } = await supabase
      .from('investors')
      .update({ pic_member: true, pic_joined_at: new Date().toISOString() })
      .eq('id', investor_id)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'pic.add_member', resourceType: 'investor', resourceId: investor_id,
      newValues: { pic_member: true },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ investor: updated }, { status: 201 });
  } catch (err: any) {
    console.error('[PIC POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
