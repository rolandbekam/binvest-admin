// @ts-nocheck
// src/app/api/admin/investor-subscriptions/route.ts
// Handles Type B (investor annual fee) and Type C (PIC adhesion fee) payments.
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

const FEE_XAF = 50_000;

// ── GET — list all fee payments (B + C) ─────────────────────────
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const investorId = searchParams.get('investor_id');
    const type = searchParams.get('type'); // 'investor_fee' | 'pic_fee'

    let query = supabase
      .from('investor_subscriptions')
      .select(`
        *,
        investor:investors(id, full_name, email, country, kyc_status, subscription_status),
        pic:pics(id, name)
      `)
      .order('created_at', { ascending: false });

    if (investorId) query = query.eq('investor_id', investorId);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;
    if (error) {
      // Graceful: table may not exist yet
      if (error.code === '42P01') return NextResponse.json({ records: [] });
      throw error;
    }

    return NextResponse.json({ records: data ?? [] });
  } catch (err: any) {
    console.error('[INVESTOR-SUBS GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST — record a fee payment ──────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const {
      investor_id,
      type,              // 'investor_fee' | 'pic_fee'
      payment_date,
      payment_method,
      bank_reference,
      notes,
      amount_xaf,
      pic_id,            // required if type === 'pic_fee'
    } = body;

    if (!investor_id || !payment_date || !payment_method) {
      return NextResponse.json({ error: 'investor_id, payment_date et payment_method sont obligatoires' }, { status: 400 });
    }
    if (type !== 'investor_fee') {
      return NextResponse.json({ error: 'type doit être "investor_fee"' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Verify investor exists
    const { data: investor } = await supabase
      .from('investors')
      .select('id, full_name, email, kyc_status, subscription_status, subscription_end_date, pic_member')
      .eq('id', investor_id)
      .single();

    if (!investor) return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });

    const effectiveAmount = amount_xaf ?? FEE_XAF;
    const payDate = new Date(payment_date);
    const startDate = payDate.toISOString().slice(0, 10);

    // ── TYPE B: annual investor subscription ────────────────────
    if (type === 'investor_fee') {
      // Compute end_date: extend from current expiry if still active, else from today
      let endDate: Date;
      if (investor.subscription_status === 'active' && investor.subscription_end_date) {
        const currentEnd = new Date(investor.subscription_end_date);
        endDate = new Date(currentEnd.getTime() + 365 * 86400000);
      } else {
        endDate = new Date(payDate.getTime() + 365 * 86400000);
      }
      const endDateStr = endDate.toISOString().slice(0, 10);

      // Insert fee record
      const { data: record, error: insertErr } = await supabase
        .from('investor_subscriptions')
        .insert({
          investor_id,
          type: 'investor_fee',
          amount_xaf: effectiveAmount,
          payment_date: startDate,
          payment_method,
          bank_reference: bank_reference ?? null,
          notes: notes ?? null,
          start_date: startDate,
          end_date: endDateStr,
          status: 'active',
          recorded_by: admin.email,
        })
        .select()
        .single();

      if (insertErr) throw insertErr;

      // Update investor subscription fields
      const { error: updateErr } = await supabase
        .from('investors')
        .update({
          subscription_status: 'active',
          subscription_start_date: startDate,
          subscription_end_date: endDateStr,
        })
        .eq('id', investor_id);

      if (updateErr) throw updateErr;

      await auditLog({
        adminId: admin.id, adminEmail: admin.email,
        action: 'investor_subscription.record',
        resourceType: 'investor_subscription', resourceId: record.id,
        newValues: { investor_id, type, amount_xaf: effectiveAmount, end_date: endDateStr },
        ipAddress: admin.ip, severity: 'info',
      });

      return NextResponse.json({ record, end_date: endDateStr }, { status: 201 });
    }

    // Should never reach here — only investor_fee is handled
    return NextResponse.json({ error: 'Type de paiement non supporté' }, { status: 400 });
  } catch (err: any) {
    console.error('[INVESTOR-SUBS POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
