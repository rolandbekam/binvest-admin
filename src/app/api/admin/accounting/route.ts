import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') ?? String(new Date().getFullYear()));
    const supabase = createAdminClient();

    // Paiements reçus par mois
    const { data: payments } = await supabase
      .from('payment_tranches')
      .select('received_amount_ngn, received_date, amount_ngn, status, subscription:subscriptions(project:projects(fee_facilitation_pct,fee_management_pct,name,target_amount_ngn), investor:investors(full_name))')
      .eq('status', 'received')
      .gte('received_date', `${year}-01-01`)
      .lte('received_date', `${year}-12-31`);

    const { data: allTranches } = await supabase
      .from('payment_tranches').select('status, amount_ngn').gte('created_at', `${year}-01-01`);

    const { data: projects } = await supabase
      .from('projects').select('id, name, target_amount_ngn, raised_amount_ngn, fee_facilitation_pct, fee_management_pct, fee_resale_pct, spots_taken');

    const { data: investors } = await supabase
      .from('investors').select('id, pic_member, pic_fee_paid');

    // Calculs
    const totalReceived = payments?.reduce((s, p) => s + (p.received_amount_ngn ?? 0), 0) ?? 0;
    const facilFees = payments?.reduce((s, p) => {
      const pct = (p.subscription as any)?.project?.fee_facilitation_pct ?? 10;
      return s + Math.round((p.received_amount_ngn ?? 0) * pct / 110);
    }, 0) ?? 0;
    const mgmtFees = projects?.reduce((s, p) => s + Math.round((p.raised_amount_ngn ?? 0) * (p.fee_management_pct ?? 3) / 100), 0) ?? 0;
    const picMembers = investors?.filter(i => i.pic_fee_paid).length ?? 0;
    const picFees = picMembers * 50000 * 0.39; // XAF to NGN approx

    // Par mois
    const monthly = Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const monthPayments = payments?.filter(p => p.received_date && new Date(p.received_date).getMonth() + 1 === month) ?? [];
      const received = monthPayments.reduce((s, p) => s + (p.received_amount_ngn ?? 0), 0);
      const fees = monthPayments.reduce((s, p) => {
        const pct = (p.subscription as any)?.project?.fee_facilitation_pct ?? 10;
        return s + Math.round((p.received_amount_ngn ?? 0) * pct / 110);
      }, 0);
      return { month, total_received: received, facilitation_fees: fees, management_fees: 0, pic_fees: 0 };
    });

    // Par projet
    const byProject = projects?.map(p => {
      const projPayments = payments?.filter(pay => (pay.subscription as any)?.project?.name === p.name) ?? [];
      const raised = projPayments.reduce((s, p) => s + (p.received_amount_ngn ?? 0), 0);
      return {
        id: p.id, name: p.name,
        target: p.target_amount_ngn, raised: p.raised_amount_ngn ?? 0,
        investors: p.spots_taken ?? 0, subscriptions: p.spots_taken ?? 0,
        facilitation_fees: Math.round((p.raised_amount_ngn ?? 0) * (p.fee_facilitation_pct ?? 10) / 100),
        management_fees_annual: Math.round((p.raised_amount_ngn ?? 0) * (p.fee_management_pct ?? 3) / 100),
        resale_pct: p.fee_resale_pct ?? 15,
        paid_tranches: allTranches?.filter(t => t.status === 'received').length ?? 0,
        total_tranches: allTranches?.length ?? 0,
      };
    }) ?? [];

    // Transactions récentes
    const transactions = payments?.slice(0, 50).map(p => ({
      date: p.received_date,
      investor_name: (p.subscription as any)?.investor?.full_name ?? 'Inconnu',
      project_name: (p.subscription as any)?.project?.name ?? 'Inconnu',
      tranche_number: 1, amount: p.received_amount_ngn, method: 'bank_transfer', reference: '—',
    })) ?? [];

    return NextResponse.json({
      total_received: totalReceived,
      facilitation_fees: facilFees,
      management_fees: mgmtFees,
      pic_fees: Math.round(picFees),
      growth_pct: 12,
      subs_count: allTranches?.length ?? 0,
      active_projects: projects?.length ?? 0,
      pic_members: picMembers,
      recovery_rate: allTranches?.length ? Math.round((allTranches.filter(t => t.status === 'received').length / allTranches.length) * 100) : 0,
      paid_tranches: allTranches?.filter(t => t.status === 'received').length ?? 0,
      total_tranches: allTranches?.length ?? 0,
      monthly, by_project: byProject, transactions,
    });
  } catch (err) {
    console.error('[ACCOUNTING]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
