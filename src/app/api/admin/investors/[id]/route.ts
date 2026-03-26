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

    const [{ data: investor }, { data: subscriptions }] = await Promise.all([
      supabase.from('investors').select('*').eq('id', id).single(),
      supabase.from('subscriptions').select(`
        *, 
        project:projects(id,name,type,status),
        tranches:payment_tranches(*)
      `).eq('investor_id', id).order('created_at', { ascending: false }),
    ]);

    if (!investor) return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });

    // Récupérer les tranches séparément
    const subIds = (subscriptions ?? []).map((s: any) => s.id);
    let tranches: any[] = [];
    if (subIds.length > 0) {
      const { data: t } = await supabase
        .from('payment_tranches')
        .select(`*, subscription:subscriptions(id, dia_reference, project:projects(name,type))`)
        .in('subscription_id', subIds)
        .order('created_at', { ascending: false });
      tranches = t ?? [];
    }

    return NextResponse.json({ investor, subscriptions: subscriptions ?? [], tranches });
  } catch (err) {
    console.error('[INVESTOR GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
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

    const { data: old } = await supabase.from('investors').select('kyc_status, notes').eq('id', id).single();
    const { data, error } = await supabase.from('investors').update(body).eq('id', id).select().single();
    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'investor.update', resourceType: 'investor', resourceId: id,
      oldValues: old as any, newValues: body,
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ investor: data });
  } catch (err) {
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
