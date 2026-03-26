import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const severity = searchParams.get('severity');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500);

    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) query = query.eq('severity', severity);

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ logs: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
