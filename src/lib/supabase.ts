// src/lib/supabase.ts
// Client Supabase SERVER-SIDE uniquement (service role)
// Ne jamais exposer le service role key côté client

import { createClient } from '@supabase/supabase-js';

// ── Client admin avec service role (toutes permissions) ──────────
// Utilisé UNIQUEMENT dans les API Routes (serveur)
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase configuration manquante. Vérifiez les variables d\'environnement.');
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    db: { schema: 'public' },
  });
}

// ── Audit Logger ─────────────────────────────────────────────────
export async function auditLog({
  adminId,
  adminEmail,
  action,
  resourceType,
  resourceId,
  oldValues,
  newValues,
  ipAddress,
  userAgent,
  severity = 'info',
}: {
  adminId?: string;
  adminEmail?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  severity?: 'info' | 'warning' | 'critical';
}) {
  try {
    const supabase = createAdminClient();
    await supabase.from('audit_logs').insert({
      admin_id: adminId || null,
      admin_email: adminEmail || 'system',
      action,
      resource_type: resourceType,
      resource_id: resourceId,
      old_values: oldValues || null,
      new_values: newValues || null,
      ip_address: ipAddress || null,
      user_agent: userAgent || null,
      severity,
    });
  } catch (err) {
    // Ne jamais faire planter l'app pour un log raté
    console.error('[AUDIT] Erreur lors de l\'enregistrement du log:', err);
  }
}

// ── Helpers pour extraire les infos admin depuis les headers ─────
export function getAdminFromHeaders(headers: Headers) {
  return {
    id: headers.get('x-admin-id') ?? undefined,
    role: (headers.get('x-admin-role') ?? 'viewer') as 'super_admin' | 'admin' | 'viewer',
    email: headers.get('x-admin-email') ?? undefined,
    ip: headers.get('x-client-ip') ?? undefined,
  };
}

// ── Vérification des permissions par rôle ────────────────────────
export type AdminRole = 'super_admin' | 'admin' | 'viewer';
export type AdminAction = 'read' | 'write' | 'delete' | 'admin';

export function hasPermission(role: AdminRole, action: AdminAction): boolean {
  const permissions: Record<AdminRole, AdminAction[]> = {
    super_admin: ['read', 'write', 'delete', 'admin'],
    admin:       ['read', 'write'],
    viewer:      ['read'],
  };
  return permissions[role]?.includes(action) ?? false;
}

/**
 * Garde route API : retourne un objet { admin, error? }.
 * Si error présent, retourner directement `error` depuis la route.
 *
 * Usage :
 *   const { admin, error } = requireAdmin(request.headers, 'write');
 *   if (error) return error;
 */
export function requireAdmin(headers: Headers, action: AdminAction = 'read') {
  const admin = getAdminFromHeaders(headers);
  if (!admin.id) {
    return {
      admin: null,
      error: new Response(JSON.stringify({ error: 'Non authentifié' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      }),
    };
  }
  if (!hasPermission(admin.role, action)) {
    return {
      admin,
      error: new Response(
        JSON.stringify({ error: `Permission "${action}" refusée pour le rôle "${admin.role}"` }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      ),
    };
  }
  return { admin, error: null };
}
