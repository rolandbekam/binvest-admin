// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

// GET: PIC detail with members list
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data: pic, error } = await supabase
      .from('pics')
      .select('*, project:projects(id, name, type, status, allows_pic)')
      .eq('id', id)
      .single();

    if (error || !pic) return NextResponse.json({ error: 'PIC introuvable' }, { status: 404 });

    const { data: memberships } = await supabase
      .from('pic_memberships')
      .select(`
        *,
        investor:investors(id, full_name, email, phone, country, kyc_status, subscription_status, is_active)
      `)
      .eq('pic_id', id)
      .order('joined_at', { ascending: true });

    return NextResponse.json({ pic, memberships: memberships ?? [] });
  } catch (err: any) {
    console.error('[PIC [ID] GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// POST: Add investor to this PIC
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const { investor_id } = await request.json();
    if (!investor_id) return NextResponse.json({ error: 'investor_id requis' }, { status: 400 });

    const supabase = createAdminClient();

    // Check PIC exists and is open
    const { data: pic } = await supabase
      .from('pics')
      .select('*, memberships:pic_memberships(id, status)')
      .eq('id', id)
      .single();

    if (!pic) return NextResponse.json({ error: 'PIC introuvable' }, { status: 404 });
    if (pic.status !== 'active') return NextResponse.json({ error: 'Ce PIC est fermé' }, { status: 422 });

    const activeCount = (pic.memberships ?? []).filter((m: any) => m.status === 'active').length;
    if (activeCount >= pic.max_members) {
      return NextResponse.json({ error: `PIC complet (${pic.max_members} membres max)` }, { status: 422 });
    }

    // Check investor KYC
    const { data: investor } = await supabase.from('investors').select('*').eq('id', investor_id).single();
    if (!investor) return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    if (investor.kyc_status !== 'approved') {
      return NextResponse.json({ error: 'KYC doit être approuvé pour rejoindre un PIC' }, { status: 422 });
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('pic_memberships')
      .select('id, status')
      .eq('pic_id', id)
      .eq('investor_id', investor_id)
      .maybeSingle();

    if (existing?.status === 'active') {
      return NextResponse.json({ error: 'Cet investisseur est déjà membre de ce PIC' }, { status: 422 });
    }

    // Generate global anonymous number: PIC-YEAR-XXX
    const year = new Date().getFullYear();
    const { data: lastMembership } = await supabase
      .from('pic_memberships')
      .select('anonymous_number')
      .like('anonymous_number', `PIC-${year}-%`)
      .order('anonymous_number', { ascending: false })
      .limit(1)
      .maybeSingle();

    let seq = 1;
    if (lastMembership?.anonymous_number) {
      const parts = lastMembership.anonymous_number.split('-');
      seq = (parseInt(parts[2] ?? '0', 10) || 0) + 1;
    }
    const anonymous_number = `PIC-${year}-${String(seq).padStart(3, '0')}`;

    let membership;
    if (existing?.status === 'revoked') {
      // Re-activate revoked membership
      const { data, error } = await supabase
        .from('pic_memberships')
        .update({ status: 'active', fee_paid: false, joined_at: new Date().toISOString(), revoked_at: null, anonymous_number })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      membership = data;
    } else {
      const { data, error } = await supabase
        .from('pic_memberships')
        .insert({ pic_id: id, investor_id, anonymous_number, fee_paid: false, status: 'active' })
        .select()
        .single();
      if (error) throw error;
      membership = data;
    }

    // Update investor pic_member flag
    await supabase
      .from('investors')
      .update({ pic_member: true, pic_joined_at: new Date().toISOString() })
      .eq('id', investor_id);

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'pic.member_add', resourceType: 'pic_membership', resourceId: membership.id,
      newValues: { pic_id: id, investor_id, anonymous_number },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ membership }, { status: 201 });
  } catch (err: any) {
    console.error('[PIC [ID] POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH: Actions on a membership (record_fee, revoke, waive_fee)
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const { membership_id, action } = await request.json();
    if (!membership_id || !['record_fee', 'revoke', 'waive_fee'].includes(action)) {
      return NextResponse.json({ error: 'membership_id et action valide requis' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: membership } = await supabase
      .from('pic_memberships')
      .select('*')
      .eq('id', membership_id)
      .eq('pic_id', id)
      .single();

    if (!membership) return NextResponse.json({ error: 'Adhésion introuvable' }, { status: 404 });

    let update: any = {};
    if (action === 'record_fee') {
      update = { fee_paid: true };
    } else if (action === 'waive_fee') {
      update = { fee_paid: true, notes: 'Frais dispensés par admin' };
    } else if (action === 'revoke') {
      update = { status: 'revoked', revoked_at: new Date().toISOString() };
      // Remove pic_member flag if no other active memberships
      const { data: others } = await supabase
        .from('pic_memberships')
        .select('id')
        .eq('investor_id', membership.investor_id)
        .eq('status', 'active')
        .neq('id', membership_id);
      if (!others || others.length === 0) {
        await supabase.from('investors')
          .update({ pic_member: false, pic_fee_paid: false })
          .eq('id', membership.investor_id);
      }
    }

    const { data: updated, error } = await supabase
      .from('pic_memberships')
      .update(update)
      .eq('id', membership_id)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: `pic.membership.${action}`, resourceType: 'pic_membership', resourceId: membership_id,
      oldValues: membership, newValues: update,
      ipAddress: admin.ip, severity: action === 'revoke' ? 'warning' : 'info',
    });

    return NextResponse.json({ membership: updated });
  } catch (err: any) {
    console.error('[PIC [ID] PATCH]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// PUT: Update PIC settings (name, max_members, project, status, description)
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const supabase = createAdminClient();

    const allowed = ['name', 'description', 'max_members', 'project_id', 'status'];
    const update: any = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }
    update.updated_at = new Date().toISOString();

    const { data, error } = await supabase.from('pics').update(update).eq('id', id).select().single();
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'pic.update', resourceType: 'pic', resourceId: id,
      newValues: update, ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ pic: data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// DELETE: Delete PIC (super_admin only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (admin.role !== 'super_admin') return NextResponse.json({ error: 'Super Admin requis' }, { status: 403 });

  try {
    const supabase = createAdminClient();
    const { data: pic } = await supabase.from('pics').select('name').eq('id', id).single();
    const { error } = await supabase.from('pics').delete().eq('id', id);
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'pic.delete', resourceType: 'pic', resourceId: id,
      oldValues: pic ?? undefined, ipAddress: admin.ip, severity: 'critical',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
