// POST /api/cards/:id/terminate
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { requireUser } from '@/lib/auth-user';
import { closeCard, isSudoConfigured, SudoError } from '@/lib/sudo';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { user, error: authErr } = await requireUser(request.headers);
  if (authErr) return authErr;
  if (!isSudoConfigured()) return NextResponse.json({ error: 'Not configured' }, { status: 503 });

  const { id } = await params;
  try {
    const supabase = createAdminClient();
    const { data: card } = await supabase
      .from('virtual_cards')
      .select('provider_card_id, provider, status')
      .eq('id', id).eq('user_id', user!.id).maybeSingle();

    if (!card) return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    if (card.status === 'terminated') {
      return NextResponse.json({ success: true, already_terminated: true });
    }
    if (card.provider !== 'sudo' || !card.provider_card_id) {
      return NextResponse.json({ error: 'Card not issued via Sudo' }, { status: 400 });
    }

    // Best-effort : on tente de fermer chez Sudo, mais on terminate côté DB de toute façon
    try {
      await closeCard(card.provider_card_id);
    } catch (e: any) {
      console.warn('[Cards/terminate] Sudo close failed:', e.message);
    }

    await supabase.from('virtual_cards').update({
      status: 'terminated', terminated_at: new Date().toISOString(),
    }).eq('id', id);

    return NextResponse.json({ success: true, status: 'terminated' });
  } catch (e: any) {
    if (e instanceof SudoError) return NextResponse.json({ error: e.message }, { status: 502 });
    return NextResponse.json({ error: e.message ?? 'Server error' }, { status: 500 });
  }
}
