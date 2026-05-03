// @ts-nocheck
// src/app/api/admin/admin-users/[id]/route.ts
// PATCH (changer rôle) + DELETE (supprimer admin) — super_admin only.

import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, requireAdmin, auditLog } from '@/lib/supabase';

const VALID_ROLES = ['super_admin', 'admin', 'viewer'];

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error } = requireAdmin(request.headers, 'admin');
  if (error) return error;

  const { id } = await params;
  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const { role } = body;
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role invalide (${VALID_ROLES.join('|')})` }, { status: 400 });
  }

  // Empêcher de se rétrograder soi-même (sécurité)
  if (admin.id === id && role !== 'super_admin') {
    return NextResponse.json({ error: 'Vous ne pouvez pas vous retirer le rôle super_admin' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from('admin_users').select('role, email').eq('id', id).maybeSingle();

  const { error: dbErr } = await supabase
    .from('admin_users')
    .update({ role })
    .eq('id', id);

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  auditLog({
    adminId: admin.id, adminEmail: admin.email,
    action: 'admin.role.update',
    resourceType: 'admin_user', resourceId: id,
    oldValues: { role: before?.role },
    newValues: { role },
    ipAddress: admin.ip, severity: 'warning',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { admin, error } = requireAdmin(request.headers, 'admin');
  if (error) return error;

  const { id } = await params;

  // Empêcher l'auto-suppression
  if (admin.id === id) {
    return NextResponse.json({ error: 'Vous ne pouvez pas supprimer votre propre compte' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: before } = await supabase
    .from('admin_users').select('email, role').eq('id', id).maybeSingle();

  const { error: dbErr } = await supabase.from('admin_users').delete().eq('id', id);
  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  auditLog({
    adminId: admin.id, adminEmail: admin.email,
    action: 'admin.delete',
    resourceType: 'admin_user', resourceId: id,
    oldValues: { email: before?.email, role: before?.role },
    ipAddress: admin.ip, severity: 'critical',
  }).catch(() => {});

  return NextResponse.json({ success: true });
}
