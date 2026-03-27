// @ts-nocheck
// src/app/api/admin/projects/route.ts
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
    const slug = body.name.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...body, slug })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ project: data }, { status: 201 });
  } catch (err: any) {
    console.error('[PROJECTS POST]', err);
    if (err.code === '23505') return NextResponse.json({ error: 'Un projet avec ce nom existe déjà' }, { status: 409 });
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
