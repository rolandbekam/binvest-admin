// @ts-nocheck
// src/app/api/admin/projects/route.ts
// Colonnes correspondant exactement à la table Supabase
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');

    let query = supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ projects: data ?? [] });
  } catch (err) {
    console.error('[PROJECTS GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
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

    // Générer le slug
    const slug = body.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    // Construire l'objet avec seulement les colonnes qui existent
    const projectData: any = {
      slug,
      name: body.name,
      type: body.type ?? 'land_banking',
      status: body.status ?? 'draft',
      description: body.description ?? null,
      location: body.location ?? null,
      state_country: body.state_country ?? null,
      surface_ha: body.surface_ha ? Number(body.surface_ha) : null,
      price_per_ha_ngn: body.price_per_ha_ngn ? Number(body.price_per_ha_ngn) : null,
      min_investment_ngn: Number(body.min_investment_ngn),
      max_investment_ngn: body.max_investment_ngn ? Number(body.max_investment_ngn) : null,
      target_amount_ngn: Number(body.target_amount_ngn),
      horizon_years: body.horizon_years ? Number(body.horizon_years) : null,
      yield_min_pct: body.yield_min_pct ? Number(body.yield_min_pct) : null,
      yield_max_pct: body.yield_max_pct ? Number(body.yield_max_pct) : null,
      tranches_count: body.tranches_count ? Number(body.tranches_count) : 1,
      spots_total: body.spots_total ? Number(body.spots_total) : 10,
      close_date: body.close_date ?? null,
      max_amount_ngn: body.max_amount_ngn ? Number(body.max_amount_ngn) : null,
      fee_facilitation_pct: body.fee_facilitation_pct ? Number(body.fee_facilitation_pct) : 10,
      fee_management_pct: body.fee_management_pct ? Number(body.fee_management_pct) : 3,
      fee_resale_pct: body.fee_resale_pct ? Number(body.fee_resale_pct) : 15,
      highlights: body.highlights ?? null,
      is_visible_app: body.is_visible_app ?? false,
      launch_date: body.launch_date ?? null,
    };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (error) {
      console.error('[PROJECTS POST ERROR]', error);
      throw error;
    }
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (err: any) {
    console.error('[PROJECTS POST]', err);
    if (err.code === '23505') return NextResponse.json({ error: 'Un projet avec ce nom existe déjà' }, { status: 409 });
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
