// src/app/api/cards/[id]/topup/route.ts
// POST /api/cards/:id/topup  Body: { amount: number }

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/auth-user';
import { fundCard, isSudoConfigured, SudoError } from '@/lib/sudo';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireUser(request.headers);
  if (authErr) return authErr;

  if (!isSudoConfigured()) {
    return NextResponse.json({ error: 'Cards provider not configured' }, { status: 503 });
  }

  const { id } = await params;

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: 'amount must be > 0' }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('provider_card_id, status, card_type, provider')
      .eq('id', id)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    if (card.status === 'terminated') return NextResponse.json({ error: 'Card terminated' }, { status: 410 });
    if (card.status === 'frozen') return NextResponse.json({ error: 'Card frozen — unfreeze first' }, { status: 409 });
    if (card.provider !== 'sudo' || !card.provider_card_id) {
      return NextResponse.json({ error: 'Card not issued via Sudo' }, { status: 400 });
    }

    const currency = card.card_type === 'usd_virtual' ? 'USD' : card.card_type === 'ngn_virtual' ? 'NGN' : 'XAF';

    // 1. Top-up Sudo
    const sudoTx = await fundCard(card.provider_card_id, amount, currency);

    // 2. RPC atomique côté DB (incrémente balance + log)
    const { data, error: rpcErr } = await supabase.rpc('topup_card', {
      p_card_id: id,
      p_amount: amount,
      p_provider_tx_id: `sudo_funding_${Date.now()}`,
    });
    if (rpcErr) throw new Error(`DB topup failed: ${rpcErr.message}`);

    return NextResponse.json({ new_balance: data?.new_balance ?? sudoTx?.balance ?? 0 });
  } catch (e: any) {
    if (e instanceof SudoError) {
      return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : 400 });
    }
    console.error('[Cards/topup] Error:', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
