// src/app/api/cards/[id]/reveal/route.ts
// POST /api/cards/:id/reveal
// Retourne PAN/CVV pour une fenêtre courte. Le mobile doit avoir validé biométrie
// AVANT d'appeler cette route. La sécurité finale est assurée par Sudo (token court).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/auth-user';
import { getCardSecureData, isSudoConfigured, SudoError } from '@/lib/sudo';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireUser(request.headers);
  if (authErr) return authErr;

  if (!isSudoConfigured()) {
    return NextResponse.json({ error: 'Cards provider not configured' }, { status: 503 });
  }

  const { id } = await params;

  try {
    // 1. Vérifier que la carte appartient bien à cet user
    const supabase = createAdminClient();
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('provider_card_id, status, provider')
      .eq('id', id)
      .eq('user_id', user!.id)
      .maybeSingle();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    if (card.status === 'terminated') {
      return NextResponse.json({ error: 'Card terminated' }, { status: 410 });
    }
    if (card.provider !== 'sudo' || !card.provider_card_id) {
      return NextResponse.json({ error: 'Card not issued via Sudo' }, { status: 400 });
    }

    // 2. Appel Sudo PCI-compliant
    const secure = await getCardSecureData(card.provider_card_id);

    // 3. Audit trail (best-effort, non bloquant)
    supabase.from('card_transactions').insert({
      card_id: id,
      user_id: user!.id,
      type: 'reversal',  // hack : pas de type "reveal" en DB, on log juste l'event
      amount: 0,
      currency: 'XAF',
      status: 'approved',
      merchant_name: 'PAN reveal request',
      merchant_category: 'audit',
    }).then(() => {});

    // 4. Retourne au mobile (HTTPS uniquement, pas de cache)
    return new NextResponse(JSON.stringify({
      card_number: secure.number,
      cvv: secure.cvv,
      expiry_month: parseInt(secure.expiryMonth, 10),
      expiry_year: parseInt(secure.expiryYear, 10),
      cardholder_name: secure.cardholderName,
      expires_at: new Date(Date.now() + 60_000).toISOString(),
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
      },
    });
  } catch (e: any) {
    if (e instanceof SudoError) {
      return NextResponse.json({ error: e.message }, { status: e.status >= 500 ? 502 : 400 });
    }
    console.error('[Cards/reveal] Error:', e);
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
