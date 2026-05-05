// src/app/api/webhooks/sudo/route.ts
// Webhook Sudo Africa — reçoit les events asynchrones (autorisations carte,
// captures, refunds, status changes). Sudo signe les payloads via HMAC-SHA256.
//
// Configuration Sudo dashboard :
//   Webhook URL : https://binvest-admin.vercel.app/api/webhooks/sudo
//   Secret      : copié dans SUDO_WEBHOOK_SECRET sur Vercel
//   Events      : card.transaction.*, card.lifecycle.*

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { verifyWebhookSignature } from '@/lib/sudo';

interface SudoWebhookEvent {
  event: string;            // ex: 'card.transaction.authorized'
  data: any;
  business: string;
  createdAt: string;
}

export async function POST(request: NextRequest) {
  const payload = await request.text();

  // 1. Vérifier la signature HMAC
  const signature = request.headers.get('x-sudo-signature') ?? request.headers.get('Sudo-Signature');
  if (!verifyWebhookSignature(payload, signature)) {
    console.warn('[Sudo Webhook] Invalid signature');
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let event: SudoWebhookEvent;
  try { event = JSON.parse(payload); }
  catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }

  console.log(`[Sudo Webhook] ${event.event}`);

  const supabase = createAdminClient();

  try {
    switch (event.event) {
      // ─── Transactions cartes ──────────────────────────────────────────────
      case 'card.transaction.authorized':
      case 'card.transaction.captured': {
        const tx = event.data;
        const sudoCardId = tx.cardId ?? tx.card?._id;
        if (!sudoCardId) break;

        // Lookup la carte interne par provider_card_id
        const { data: card } = await supabase
          .from('virtual_cards').select('id, user_id')
          .eq('provider_card_id', sudoCardId).maybeSingle();
        if (!card) break;

        const txType = event.event.endsWith('captured') ? 'capture' : 'authorization';
        const status = tx.status === 'declined' ? 'declined' : 'approved';

        // RPC atomique : insert transaction + débite la carte si approved capture
        await supabase.rpc('record_card_transaction', {
          p_card_id: card.id,
          p_type: txType,
          p_amount: Number(tx.amount ?? 0),
          p_currency: tx.currency ?? 'USD',
          p_status: status,
          p_merchant_name: tx.merchant?.name ?? tx.merchantName ?? null,
          p_merchant_category: tx.merchant?.category ?? tx.merchantCategory ?? null,
          p_provider_tx_id: tx._id ?? tx.id ?? null,
        });
        break;
      }

      case 'card.transaction.declined': {
        const tx = event.data;
        const sudoCardId = tx.cardId ?? tx.card?._id;
        if (!sudoCardId) break;

        const { data: card } = await supabase
          .from('virtual_cards').select('id, user_id')
          .eq('provider_card_id', sudoCardId).maybeSingle();
        if (!card) break;

        await supabase.from('card_transactions').insert({
          card_id: card.id,
          user_id: card.user_id,
          provider_tx_id: tx._id ?? tx.id,
          type: 'authorization',
          amount: Number(tx.amount ?? 0),
          currency: tx.currency ?? 'USD',
          status: 'declined',
          decline_reason: tx.declineReason ?? tx.reason ?? null,
          merchant_name: tx.merchant?.name ?? null,
          merchant_category: tx.merchant?.category ?? null,
        });
        break;
      }

      case 'card.transaction.refunded':
      case 'card.transaction.reversed': {
        const tx = event.data;
        const sudoCardId = tx.cardId ?? tx.card?._id;
        if (!sudoCardId) break;

        const { data: card } = await supabase
          .from('virtual_cards').select('id, user_id')
          .eq('provider_card_id', sudoCardId).maybeSingle();
        if (!card) break;

        const isReversal = event.event.endsWith('reversed');
        await supabase.rpc('record_card_transaction', {
          p_card_id: card.id,
          p_type: isReversal ? 'reversal' : 'refund',
          p_amount: Number(tx.amount ?? 0),
          p_currency: tx.currency ?? 'USD',
          p_status: 'approved',
          p_merchant_name: tx.merchant?.name ?? 'Remboursement',
          p_merchant_category: null,
          p_provider_tx_id: tx._id ?? tx.id,
        });

        // Re-créditer la carte (refund/reversal)
        await supabase.from('virtual_cards').update({
          current_balance: supabase.rpc('greatest', { a: 0, b: 0 }) as any,
        }).eq('id', card.id);
        // Note : la logique exacte de re-crédit dépend de votre flux. Pour MVP,
        // on laisse l'admin faire un manual reconcile via l'audit log si besoin.
        break;
      }

      // ─── Status carte ─────────────────────────────────────────────────────
      case 'card.lifecycle.activated':
      case 'card.lifecycle.suspended':
      case 'card.lifecycle.terminated': {
        const sudoCardId = event.data.cardId ?? event.data._id;
        if (!sudoCardId) break;

        const newStatus = event.event.endsWith('activated') ? 'active'
                       : event.event.endsWith('suspended') ? 'frozen'
                       : 'terminated';

        await supabase.from('virtual_cards').update({
          status: newStatus,
          ...(newStatus === 'frozen' ? { frozen_at: new Date().toISOString() } : {}),
          ...(newStatus === 'terminated' ? { terminated_at: new Date().toISOString() } : {}),
          ...(newStatus === 'active' ? { frozen_at: null } : {}),
        }).eq('provider_card_id', sudoCardId);
        break;
      }

      default:
        console.log(`[Sudo Webhook] Unhandled event: ${event.event}`);
    }

    return NextResponse.json({ received: true });
  } catch (e: any) {
    console.error('[Sudo Webhook] Processing error:', e);
    // Important : retourner 200 pour ne pas que Sudo retry indéfiniment.
    // Le log permet de débugger sans casser le flux.
    return NextResponse.json({ received: true, error: e.message }, { status: 200 });
  }
}

// Sudo envoie en POST mais ajoutons GET pour test santé du webhook
export async function GET() {
  return NextResponse.json({ status: 'webhook endpoint live', ready: true });
}
