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
    return NextResponse.json({ projects: data ?? [] });
  } catch (err: any) {
    console.error('[PROJECTS GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const body = await request.json();

    if (!body.name || !body.min_investment_ngn || !body.target_amount_ngn) {
      return NextResponse.json({ error: 'Champs obligatoires manquants' }, { status: 400 });
    }

    const slug = body.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    const insert: any = {
      slug,
      name:               String(body.name),
      type:               body.type ?? 'land_banking',
      status:             body.status ?? 'draft',
      description:        body.description ?? null,
      location:           body.location ?? null,
      state_country:      body.state_country ?? null,
      min_investment_ngn: Number(body.min_investment_ngn),
      target_amount_ngn:  Number(body.target_amount_ngn),
      raised_amount_ngn:  0,
      horizon_years:      body.horizon_years  ? Number(body.horizon_years)  : null,
      yield_min_pct:      body.yield_min_pct  ? Number(body.yield_min_pct)  : null,
      yield_max_pct:      body.yield_max_pct  ? Number(body.yield_max_pct)  : null,
      tranches_count:     body.tranches_count ? Number(body.tranches_count) : 1,
      spots_total:        body.spots_total    ? Number(body.spots_total)    : 10,
      spots_taken:        0,
      fee_facilitation_pct: body.fee_facilitation_pct ? Number(body.fee_facilitation_pct) : 10,
      fee_management_pct:   body.fee_management_pct   ? Number(body.fee_management_pct)   : 3,
      fee_resale_pct:       body.fee_resale_pct       ? Number(body.fee_resale_pct)       : 15,
      highlights:     Array.isArray(body.highlights) ? body.highlights : null,
      is_visible_app: body.is_visible_app ?? false,
      launch_date:    body.launch_date ?? null,
      close_date:     body.close_date  ?? null,
    };

    // Colonnes optionnelles présentes dans l'ancienne table
    if (body.surface_ha)       insert.surface_ha        = Number(body.surface_ha);
    if (body.price_per_ha_ngn) insert.price_per_ha_ngn  = Number(body.price_per_ha_ngn);
    if (body.max_investment_ngn) insert.max_investment_ngn = Number(body.max_investment_ngn);
    if (body.max_amount_ngn)   insert.max_amount_ngn    = Number(body.max_amount_ngn);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .insert(insert)
      .select()
      .single();

    if (error) {
      console.error('[PROJECTS POST DB ERROR]', JSON.stringify(error));
      return NextResponse.json({ error: error.message, details: error.details, hint: error.hint }, { status: 500 });
    }

    return NextResponse.json({ project: data }, { status: 201 });

  } catch (err: any) {
    console.error('[PROJECTS POST]', err);
    if (err.code === '23505') return NextResponse.json({ error: 'Un projet avec ce nom existe déjà' }, { status: 409 });
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
