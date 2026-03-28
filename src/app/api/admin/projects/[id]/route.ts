// @ts-nocheck
// src/app/api/admin/projects/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 });
    return NextResponse.json({ project: data });
  } catch (err: any) {
    console.error('[PROJECTS GET ID]', err);
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
    const { data: old } = await supabase.from('projects').select('*').eq('id', id).single();

    const allowed = [
      'name','type','status','description','location','state_country',
      'min_investment_ngn','target_amount_ngn','max_amount_ngn',
      'horizon_years','yield_min_pct','yield_max_pct',
      'tranches_count','spots_total','fee_facilitation_pct',
      'fee_management_pct','fee_resale_pct',
      'is_visible_app','close_date','launch_date','highlights',
      'surface_ha','price_per_ha_ngn',
    ];
    const update: any = {};
    for (const key of allowed) {
      if (key in body) update[key] = body[key];
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('projects')
      .update(update)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'project.update', resourceType: 'project', resourceId: id,
      oldValues: old ?? undefined, newValues: update,
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ project: data });
  } catch (err: any) {
    console.error('[PROJECTS PUT]', err);
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
    const { data: old } = await supabase.from('projects').select('name,status').eq('id', id).single();
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'project.delete', resourceType: 'project', resourceId: id,
      oldValues: old ?? undefined,
      ipAddress: admin.ip, severity: 'warning',
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[PROJECTS DELETE]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
