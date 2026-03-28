// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

const PIC_FEE_XAF = 50000;

// GET: List all PICs with member counts + stats
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data: pics, error } = await supabase
      .from('pics')
      .select(`
        *,
        project:projects(id, name, type, status, allows_pic),
        memberships:pic_memberships(id, fee_paid, status, anonymous_number)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = (pics ?? []).map(p => ({
      ...p,
      member_count: (p.memberships ?? []).filter((m: any) => m.status === 'active').length,
      fees_paid_count: (p.memberships ?? []).filter((m: any) => m.status === 'active' && m.fee_paid).length,
      spots_remaining: p.max_members - (p.memberships ?? []).filter((m: any) => m.status === 'active').length,
    }));

    const stats = {
      total_pics: list.length,
      active_pics: list.filter(p => p.status === 'active').length,
      total_members: list.reduce((sum, p) => sum + p.member_count, 0),
      total_fees_xaf: list.reduce((sum, p) => sum + p.fees_paid_count, 0) * PIC_FEE_XAF,
    };

    return NextResponse.json({ pics: list, stats });
  } catch (err: any) {
    console.error('[PIC GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// POST: Create a new PIC group
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!['super_admin', 'admin'].includes(admin.role)) {
    return NextResponse.json({ error: 'Droits insuffisants' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, project_id, max_members, description } = body;

    if (!name) return NextResponse.json({ error: 'Nom du PIC requis' }, { status: 400 });

    const supabase = createAdminClient();

    // Verify project allows PIC if specified
    if (project_id) {
      const { data: project } = await supabase
        .from('projects')
        .select('allows_pic, name')
        .eq('id', project_id)
        .single();
      if (project && project.allows_pic === false) {
        return NextResponse.json(
          { error: `Le projet "${project.name}" n'accepte pas les investissements PIC` },
          { status: 422 }
        );
      }
    }

    const { data, error } = await supabase
      .from('pics')
      .insert({
        name,
        project_id: project_id || null,
        max_members: max_members ?? 20,
        description: description ?? null,
        status: 'active',
        created_by: admin.email,
      })
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'pic.create', resourceType: 'pic', resourceId: data.id,
      newValues: { name, project_id, max_members },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ pic: data }, { status: 201 });
  } catch (err: any) {
    console.error('[PIC POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH: Legacy investor-level PIC actions (backward compat)
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
