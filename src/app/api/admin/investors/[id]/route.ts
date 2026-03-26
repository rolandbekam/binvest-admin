import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, auditLog, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const { id } = await context.params;
    const supabase = createAdminClient();
    const { data: investor } = await supabase.from('investors').select('*').eq('id', id).single();
    if (!investor) return NextResponse.json({ error: 'Introuvable' }, { status: 404 });
    const { data: subscriptions } = await supabase.from('subscriptions')
      .select('*, project:projects(id,name,type), tranches:payment_tranches(*)')
      .eq('investor_id', id);
    return NextResponse.json({ investor, subscriptions: subscriptions ?? [], tranches: [] });
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const { id } = await context.params;
    const body = await request.json();
    const supabase = createAdminClient();
    const { data, error } = await supabase.from('investors').update(body).eq('id', id).select().single();
    if (error) throw error;
    return NextResponse.json({ investor: data });
  } catch { return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 }); }
}