// POST /api/cards/:id/unfreeze
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/auth-user';
import { unlockCard, isSudoConfigured, SudoError } from '@/lib/sudo';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireUser(request.headers);
  if (authErr) return authErr;
  if (!isSudoConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('provider_card_id, provider')
      .eq('id', id).eq('user_id', user!.id).maybeSingle();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    if (card.provider !== 'sudo' || !card.provider_card_id) {
      return NextResponse.json({ error: 'Card not issued via Sudo' }, { status: 400 });
    }

    await unlockCard(card.provider_card_id);
    await supabase.from('virtual_cards').update({
      status: 'active', frozen_at: null,
    }).eq('id', id);

    return NextResponse.json({ success: true, status: 'active' });
  } catch (e: any) {
    if (e instanceof SudoError) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
