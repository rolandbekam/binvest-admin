// @ts-nocheck
// src/app/api/admin/admin-users/route.ts
// CRUD des comptes administrateurs — accessible uniquement aux super_admin.

import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createAdminClient, requireAdmin, auditLog } from '@/lib/supabase';

const VALID_ROLES = ['super_admin', 'admin', 'viewer'];

// Aligné sur /api/auth/login : SHA-256 + PASSWORD_PEPPER
function hashPassword(password: string): string {
  const pepper = process.env.PASSWORD_PEPPER ?? '';
  return createHash('sha256').update(password + pepper).digest('hex');
}

export async function GET(request: NextRequest) {
  const { admin, error } = requireAdmin(request.headers, 'admin');
  if (error) return error;

  const supabase = createAdminClient();
  const { data, error: dbErr } = await supabase
    .from('admin_users')
    .select('id, email, full_name, role, created_at, last_login_at')
    .order('created_at', { ascending: false });

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });
  return NextResponse.json({ admins: data ?? [] });
}

export async function POST(request: NextRequest) {
  const { admin, error } = requireAdmin(request.headers, 'admin');
  if (error) return error;

  let body: any;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

  const { email, full_name, role, password } = body;
  if (!email || !full_name || !password) {
    return NextResponse.json({ error: 'email, full_name, password requis' }, { status: 400 });
  }
  if (!VALID_ROLES.includes(role)) {
    return NextResponse.json({ error: `role invalide (${VALID_ROLES.join('|')})` }, { status: 400 });
  }
  if (password.length < 8) {
    return NextResponse.json({ error: 'Mot de passe : 8 caractères minimum' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Check unicité email
  const { data: existing } = await supabase
    .from('admin_users').select('id').eq('email', email.toLowerCase()).maybeSingle();
  if (existing) {
    return NextResponse.json({ error: 'Un admin avec cet email existe déjà' }, { status: 409 });
  }

  const password_hash = hashPassword(password);

  const { data, error: dbErr } = await supabase
    .from('admin_users')
    .insert({
      email: email.toLowerCase().trim(),
      full_name: full_name.trim(),
      role,
      password_hash,
    })
    .select('id, email, full_name, role, created_at')
    .single();

  if (dbErr) return NextResponse.json({ error: dbErr.message }, { status: 500 });

  auditLog({
    adminId: admin.id, adminEmail: admin.email,
    action: 'admin.create',
    resourceType: 'admin_user', resourceId: data.id,
    newValues: { email: data.email, role: data.role },
    ipAddress: admin.ip, severity: 'warning',
  }).catch(() => {});

  return NextResponse.json({ admin: data, success: true });
}
