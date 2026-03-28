// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('payment_requests')
      .select(`
        *,
        subscription:subscriptions(
          id, dia_reference,
          investor:investors(id, full_name, email),
          project:projects(id, name, type)
        )
      `)
      .eq('status', 'submitted')
      .order('submitted_at', { ascending: true });

    if (error) {
      // Table may not exist yet — return empty gracefully
      if (error.code === '42P01') return NextResponse.json({ requests: [] });
      throw error;
    }

    return NextResponse.json({ requests: data ?? [] });
  } catch (err: any) {
    console.error('[PAYMENT-REQUESTS GET]', err);
    return NextResponse.json({ requests: [] });
  }
}
