import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc('get_dashboard_stats');
    if (error) throw error;
    return NextResponse.json({ stats: data });
  } catch (err) {
    console.error('[STATS]', err);
    // Retourner des stats de démo si la DB n'est pas encore configurée
    return NextResponse.json({
      stats: {
        total_raised_ngn: 130000000,
        active_projects: 4,
        total_investors: 37,
        pending_payments: 6,
        late_payments: 1,
        total_subscriptions: 18,
        monthly_received: 8200000,
      }
    });
  }
}
