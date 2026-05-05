// src/app/api/cards/create/route.ts
// POST /api/cards/create
// Body: { card_type: 'usd_virtual'|'ngn_virtual', nickname?: string, initial_topup?: number }
// Auth: Bearer <supabase JWT> du mobile

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireUser, getOrCreateSudoCustomer } from '@/lib/auth-user';
import { createCard, fundCard, isSudoConfigured, SudoError } from '@/lib/sudo';

export async function POST(request: NextRequest) {
  // 1. Auth user
  const { user, error: authErr } = await requireUser(request.headers);
  if (authErr) return authErr;

  if (!isSudoConfigured()) {
    return NextResponse.json(
      { error: 'Cards provider not configured (SUDO_API_KEY missing on server)' },
      { status: 503 },
    );
  }

  // 2. Validate body
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const { card_type, nickname, initial_topup } = body;
  if (!['usd_virtual', 'ngn_virtual'].includes(card_type)) {
    return NextResponse.json({ error: 'Invalid card_type' }, { status: 400 });
  }
  if (initial_topup != null && (typeof initial_topup !== 'number' || initial_topup < 0)) {
    return NextResponse.json({ error: 'initial_topup must be a non-negative number' }, { status: 400 });
  }

  const currency = card_type === 'usd_virtual' ? 'USD' : 'NGN';

  try {
    // 3. Get or create Sudo customer (idempotent, lit/écrit profiles.sudo_customer_id)
    const customerId = await getOrCreateSudoCustomer(user!.id);

    // 4. Create card chez Sudo
    const sudoCard = await createCard({
      customerId,
      type: 'virtual',
      brand: 'Visa',
      currency,
      status: 'active',
    });

    // 5. Persiste en Supabase (user-side, RLS protégé)
    const supabase = createAdminClient();
    const last4 = sudoCard.maskedPan?.replace(/[^0-9]/g, '').slice(-4) ?? null;

    const { data: persisted, error: dbErr } = await supabase
      .from('virtual_cards')
      .insert({
        user_id: user!.id,
        provider: 'sudo',
        provider_card_id: sudoCard._id,
        provider_customer_id: customerId,
        card_brand: sudoCard.brand?.toLowerCase() ?? 'visa',
        card_type,
        nickname: nickname?.trim() || null,
        last_4: last4,
        expiry_month: parseInt(sudoCard.expiryMonth, 10),
        expiry_year: parseInt(sudoCard.expiryYear, 10),
        status: 'active',
        current_balance: 0,
      })
      .select()
      .single();

    if (dbErr) throw new Error(`DB insert failed: ${dbErr.message}`);

    // 6. Top-up initial si demandé
    if (initial_topup && initial_topup > 0) {
      try {
        await fundCard(sudoCard._id, initial_topup, currency);
        await supabase.rpc('topup_card', {
          p_card_id: persisted.id,
          p_amount: initial_topup,
          p_provider_tx_id: `sudo_funding_${Date.now()}`,
        });
        persisted.current_balance = initial_topup;
      } catch (e: any) {
        // Top-up failed mais carte créée — on log et on retourne quand même
        console.error('[Cards/create] Initial topup failed:', e.message);
      }
    }

    return NextResponse.json(persisted);
  } catch (e: any) {
    if (e instanceof SudoError) {
      console.error('[Cards/create] Sudo error:', e.status, e.body);
      return NextResponse.json(
        { error: e.message, details: e.body },
        { status: e.status >= 500 ? 502 : 400 },
      );
    }
    console.error('[Cards/create] Error:', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
