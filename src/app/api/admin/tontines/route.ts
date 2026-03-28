// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data: tontines, error } = await supabase
      .from('tontines')
      .select('*, creator:profiles(id, full_name, phone, country)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    const list = tontines ?? [];
    const active = list.filter(t => t.is_active);

    const stats = {
      total_active: active.length,
      total_tontines: list.length,
      total_managed: active.reduce((s, t) => s + (t.contribution_amount ?? 0) * (t.total_members ?? 0), 0),
      total_members: active.reduce((s, t) => s + (t.total_members ?? 0), 0),
    };

    return NextResponse.json({ tontines: list, stats });
  } catch (err: any) {
    console.error('[TONTINES]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
