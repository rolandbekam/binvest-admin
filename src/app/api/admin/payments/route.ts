// @ts-nocheck
// src/app/api/admin/payments/route.ts
// API Paiements — Enregistrement sécurisé avec accusé de réception

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient, auditLog, getAdminFromHeaders, hasPermission } from '@/lib/supabase';

const RecordPaymentSchema = z.object({
  subscription_id: z.string().uuid(),
  tranche_number: z.number().int().min(1),
  received_amount_ngn: z.number().positive(),
  received_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  received_currency: z.string().default('NGN'),
  exchange_rate: z.number().positive().optional(),
  payment_method: z.enum(['bank_transfer', 'mobile_money', 'cash', 'crypto', 'other']),
  bank_reference: z.string().optional(),
  notes: z.string().optional(),
});

// ── GET — Liste des tranches ─────────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const subscriptionId = searchParams.get('subscription_id');

    let query = supabase
      .from('payment_tranches')
      .select(`
        *,
        subscription:subscriptions(
          id, dia_reference, amount_ngn, total_amount_ngn,
          investor:investors(id, full_name, email, country),
          project:projects(id, name, type)
        )
      `)
      .order('due_date', { ascending: true });

    if (status) query = query.eq('status', status);
    if (subscriptionId) query = query.eq('subscription_id', subscriptionId);

    const { data, error } = await query;
    if (error) throw error;

    // Calcul statistiques
    const stats = {
      total_pending: data?.filter(t => t.status === 'pending').reduce((s, t) => s + t.amount_ngn, 0) ?? 0,
      total_received: data?.filter(t => t.status === 'received').reduce((s, t) => s + (t.received_amount_ngn ?? 0), 0) ?? 0,
      total_late: data?.filter(t => t.status === 'late').reduce((s, t) => s + t.amount_ngn, 0) ?? 0,
      count_pending: data?.filter(t => t.status === 'pending').length ?? 0,
      count_late: data?.filter(t => t.status === 'late').length ?? 0,
    };

    return NextResponse.json({ tranches: data, stats });

  } catch (err) {
    console.error('[PAYMENTS GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST — Enregistrer un paiement ───────────────────────────────
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(admin.role, 'write')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  const supabase = createAdminClient();

  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

    const parsed = RecordPaymentSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    const { subscription_id, tranche_number, received_amount_ngn, ...rest } = parsed.data;

    // ── Vérifier la tranche existe et n'est pas déjà payée ───────
    const { data: existing, error: fetchError } = await supabase
      .from('payment_tranches')
      .select('*, subscription:subscriptions(investor:investors(full_name, email), project:projects(name))')
      .eq('subscription_id', subscription_id)
      .eq('tranche_number', tranche_number)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Tranche introuvable' }, { status: 404 });
    }

    if (existing.status === 'received') {
      return NextResponse.json({ error: 'Cette tranche a déjà été enregistrée comme reçue' }, { status: 409 });
    }

    // ── Calcul équivalent NGN si autre devise ────────────────────
    const equivalentNgn = rest.exchange_rate
      ? Math.round(received_amount_ngn * rest.exchange_rate)
      : received_amount_ngn;

    // ── Mettre à jour la tranche ─────────────────────────────────
    const { data: updated, error: updateError } = await supabase
      .from('payment_tranches')
      .update({
        status: 'received',
        received_amount_ngn,
        equivalent_ngn: equivalentNgn,
        received_date: rest.received_date,
        received_currency: rest.received_currency,
        exchange_rate: rest.exchange_rate,
        payment_method: rest.payment_method,
        bank_reference: rest.bank_reference,
        notes: rest.notes,
        acknowledgement_issued: true,
        acknowledgement_date: new Date().toISOString(),
        recorded_by: admin.id,
      })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) throw updateError;

    // ── Mettre à jour le montant levé du projet ──────────────────
    await supabase.rpc('increment_raised_amount', {
      p_subscription_id: subscription_id,
      p_amount: equivalentNgn,
    }).catch(() => {
      // Si la fonction RPC n'existe pas, on met à jour manuellement
      supabase
        .from('subscriptions')
        .select('project_id')
        .eq('id', subscription_id)
        .single()
        .then(({ data: sub }) => {
          if (sub) {
            supabase.rpc('update_project_raised', {
              p_project_id: sub.project_id,
              p_amount: equivalentNgn,
            });
          }
        });
    });

    // ── Vérifier si toutes les tranches sont payées ───────────────
    const { data: allTranches } = await supabase
      .from('payment_tranches')
      .select('status')
      .eq('subscription_id', subscription_id);

    const allPaid = allTranches?.every(t => t.status === 'received');
    if (allPaid) {
      await supabase
        .from('subscriptions')
        .update({ status: 'complete' })
        .eq('id', subscription_id);
    }

    // ── Audit trail (niveau CRITICAL pour les paiements) ─────────
    await auditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'payment.record',
      resourceType: 'payment_tranche',
      resourceId: existing.id,
      oldValues: { status: existing.status, received_amount_ngn: null },
      newValues: {
        status: 'received',
        received_amount_ngn,
        equivalent_ngn: equivalentNgn,
        payment_method: rest.payment_method,
        bank_reference: rest.bank_reference,
        investor: (existing as any).subscription?.investor?.full_name,
        project: (existing as any).subscription?.project?.name,
      },
      ipAddress: admin.ip,
      severity: 'critical',  // Toujours CRITICAL pour les paiements
    });

    return NextResponse.json({
      success: true,
      tranche: updated,
      acknowledgement: {
        reference: `ACK-${subscription_id.slice(0, 8).toUpperCase()}-T${tranche_number}`,
        issued_at: new Date().toISOString(),
        amount_ngn: received_amount_ngn,
        payment_method: rest.payment_method,
      },
    });

  } catch (err) {
    console.error('[PAYMENTS POST]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
