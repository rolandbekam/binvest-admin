// @ts-nocheck
// src/app/api/admin/projects/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ projects: data ?? [], count: data?.length ?? 0 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch (e: any) {
    return NextResponse.json({ error: 'JSON invalide', details: e.message }, { status: 400 });
  }

  if (!body.name || !body.min_investment_ngn || !body.target_amount_ngn) {
    return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
  }

  const slug = body.name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);

  const insert: any = {
    slug,
    name: String(body.name),
    type: body.type ?? 'land_banking',
    status: body.status ?? 'draft',
    description: body.description ?? null,
    location: body.location ?? null,
    min_investment_ngn: Number(body.min_investment_ngn),
    target_amount_ngn: Number(body.target_amount_ngn),
    raised_amount_ngn: 0,
    horizon_years: body.horizon_years ? Number(body.horizon_years) : null,
    yield_min_pct: body.yield_min_pct ? Number(body.yield_min_pct) : null,
    yield_max_pct: body.yield_max_pct ? Number(body.yield_max_pct) : null,
    tranches_count: body.tranches_count ? Number(body.tranches_count) : 1,
    spots_total: body.spots_total ? Number(body.spots_total) : 10,
    spots_taken: 0,
    fee_facilitation_pct: body.fee_facilitation_pct ? Number(body.fee_facilitation_pct) : 10,
    fee_management_pct: body.fee_management_pct ? Number(body.fee_management_pct) : 3,
    fee_resale_pct: body.fee_resale_pct ? Number(body.fee_resale_pct) : 15,
    highlights: Array.isArray(body.highlights) ? body.highlights : null,
    is_visible_app: body.is_visible_app ?? false,
    close_date: body.close_date ?? null,
    max_amount_ngn: body.max_amount_ngn ? Number(body.max_amount_ngn) : null,
  };

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('projects').insert(insert).select().single();
    if (error) return NextResponse.json({ error: error.message, code: error.code, hint: error.hint }, { status: 500 });
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
