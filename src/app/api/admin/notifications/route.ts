// @ts-nocheck
// src/app/api/admin/notifications/route.ts
// Reads from the `notifications` Supabase table (populated by mobile app / DB triggers).

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders, auditLog } from '@/lib/supabase';

// ── GET — unread notifications ───────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('is_read', false)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      // Table may not exist yet
      if (error.code === '42P01') return NextResponse.json({ notifications: [], counts: { total: 0, kyc: 0, payments: 0 } });
      throw error;
    }

    const notifications = data ?? [];

    // Count by type for badges
    const counts = {
      total: notifications.length,
      kyc: notifications.filter(n => n.type === 'kyc').length,
      payments: notifications.filter(n => n.type === 'payment').length,
    };

    return NextResponse.json({ notifications, counts });
  } catch (err: any) {
    console.error('[NOTIFICATIONS GET]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// ── PATCH — mark a notification as read ──────────────────────────
export async function PATCH(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const { id, mark_all } = body;

    const supabase = createAdminClient();

    if (mark_all) {
      await supabase.from('notifications').update({ is_read: true }).eq('is_read', false);
      return NextResponse.json({ success: true, marked: 'all' });
    }

    if (!id) return NextResponse.json({ error: 'id requis' }, { status: 400 });

    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', id);

    if (error) throw error;
    return NextResponse.json({ success: true, id });
  } catch (err: any) {
    console.error('[NOTIFICATIONS PATCH]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST — KYC approve / reject action ───────────────────────────
// Keeps backward compat with dashboard KYC action buttons.
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const body = await request.json();
    const { investor_id, action, rejection_reason, notification_id, send_email = true } = body;

    if (!investor_id || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'investor_id et action (approve|reject) requis' }, { status: 400 });
    }
    if (action === 'reject' && !rejection_reason?.trim()) {
      return NextResponse.json({ error: 'La raison du rejet est obligatoire' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // Fetch investor
    const { data: investor, error: fetchErr } = await supabase
      .from('investors')
      .select('id, full_name, email, kyc_status, user_id')
      .eq('id', investor_id)
      .single();

    if (fetchErr || !investor) {
      return NextResponse.json({ error: 'Investisseur introuvable' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // 1. Update investors table
    const investorUpdate: any = {
      kyc_status: newStatus,
      kyc_reviewed_by: admin.email,
      kyc_reviewed_at: new Date().toISOString(),
    };
    if (action === 'reject') investorUpdate.kyc_rejection_reason = rejection_reason;

    const { error: invErr } = await supabase
      .from('investors')
      .update(investorUpdate)
      .eq('id', investor_id);
    if (invErr) throw invErr;

    // 2. Update kyc_submissions table (if exists)
    const kycSubUpdate: any = {
      status: newStatus,
      reviewed_by: admin.email,
      reviewed_at: new Date().toISOString(),
    };
    if (action === 'reject') kycSubUpdate.rejection_reason = rejection_reason;

    // Match by investor_id or by data->>'user_id' matching the investor's user_id
    await supabase
      .from('kyc_submissions')
      .update(kycSubUpdate)
      .eq('investor_id', investor_id)
      .in('status', ['submitted', 'pending', 'in_review'])
      .then(() => {});  // best-effort, ignore if table doesn't exist

    if (investor.user_id) {
      await supabase
        .from('kyc_submissions')
        .update(kycSubUpdate)
        .eq('user_id', investor.user_id)
        .in('status', ['submitted', 'pending', 'in_review'])
        .then(() => {});
    }

    // 3. Mark the triggering notification as read
    if (notification_id) {
      await supabase.from('notifications').update({ is_read: true }).eq('id', notification_id);
    } else {
      // Auto-find and mark KYC notifications for this investor as read
      const filter = investor.user_id
        ? `user_id.eq.${investor.user_id}`
        : null;
      if (filter) {
        await supabase
          .from('notifications')
          .update({ is_read: true })
          .eq('type', 'kyc')
          .eq('is_read', false)
          .eq('user_id', investor.user_id)
          .then(() => {});
      }
    }

    // 4. Send email notification (non-blocking)
    if (send_email && investor.email) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
      fetch(`${appUrl}/api/admin/email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-id': admin.id,
          'x-admin-email': admin.email,
          'x-admin-role': admin.role ?? 'admin',
        },
        body: JSON.stringify({
          type: action === 'approve' ? 'kyc_approved' : 'kyc_rejected',
          investor_id,
          variables: { name: investor.full_name, reason: rejection_reason ?? '', lang: 'fr' },
        }),
      }).catch(e => console.warn('[NOTIFICATIONS] Email non-bloquant:', e));
    }

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: `investor.kyc.${action}`,
      resourceType: 'investor', resourceId: investor_id,
      oldValues: { kyc_status: investor.kyc_status },
      newValues: { kyc_status: newStatus, rejection_reason: rejection_reason ?? null },
      ipAddress: admin.ip, severity: 'warning',
    });

    return NextResponse.json({ success: true, action, investor_id, kyc_status: newStatus });
  } catch (err: any) {
    console.error('[NOTIFICATIONS POST]', err);
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
