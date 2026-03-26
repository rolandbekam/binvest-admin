// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`*, investor:investors(full_name,email,country), project:projects(name,type), tranches:payment_tranches(id,tranche_number,amount_ngn,status,received_amount_ngn,received_date,due_date)`)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return NextResponse.json({ subscriptions: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
