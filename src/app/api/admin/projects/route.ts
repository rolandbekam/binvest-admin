// src/app/api/admin/projects/route.ts
// API Projects — CRUD sécurisé avec audit trail

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient, auditLog, getAdminFromHeaders, hasPermission } from '@/lib/supabase';

const ProjectSchema = z.object({
  name: z.string().min(3).max(200),
  type: z.enum(['land_banking', 'agriculture_palmier', 'agriculture_manioc', 'capital_markets', 'immobilier']),
  status: z.enum(['draft', 'open', 'active', 'closed', 'completed']).default('draft'),
  description: z.string().optional(),
  location: z.string().optional(),
  state_country: z.string().optional(),
  surface_ha: z.number().positive().optional(),
  price_per_ha_ngn: z.number().positive().optional(),
  min_investment_ngn: z.number().positive(),
  max_investment_ngn: z.number().positive().optional(),
  target_amount_ngn: z.number().positive(),
  horizon_years: z.number().int().positive().optional(),
  yield_min_pct: z.number().min(0).max(100).optional(),
  yield_max_pct: z.number().min(0).max(100).optional(),
  tranches_count: z.number().int().min(1).max(12).default(1),
  spots_total: z.number().int().min(1).max(100).default(10),
  fee_facilitation_pct: z.number().min(0).max(50).default(10),
  fee_management_pct: z.number().min(0).max(20).default(3),
  fee_resale_pct: z.number().min(0).max(50).default(15),
  highlights: z.array(z.string()).optional(),
  is_visible_app: z.boolean().default(false),
  launch_date: z.string().optional(),
  close_date: z.string().optional(),
});

// ── GET — Liste des projets ──────────────────────────────────────
export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20'), 100);
    const offset = (page - 1) * limit;

    let query = supabase
      .from('projects')
      .select(`
        *,
        subscriptions_count:subscriptions(count),
        updates_count:project_updates(count)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) query = query.eq('status', status);
    if (type) query = query.eq('type', type);

    const { data, error, count } = await query;
    if (error) throw error;

    return NextResponse.json({
      projects: data,
      pagination: { page, limit, total: count ?? 0, pages: Math.ceil((count ?? 0) / limit) },
    });

  } catch (err) {
    console.error('[PROJECTS GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// ── POST — Créer un projet ───────────────────────────────────────
export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(admin.role, 'write')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  try {
    let body: unknown;
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: 'JSON invalide' }, { status: 400 }); }

    const parsed = ProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });
    }

    // Générer le slug
    const slug = parsed.data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      + '-' + Date.now().toString(36);

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('projects')
      .insert({ ...parsed.data, slug, created_by: admin.id })
      .select()
      .single();

    if (error) throw error;

    // Audit trail
    await auditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'project.create',
      resourceType: 'project',
      resourceId: data.id,
      newValues: { name: data.name, type: data.type, target: data.target_amount_ngn },
      ipAddress: admin.ip,
      severity: 'info',
    });

    return NextResponse.json({ project: data }, { status: 201 });

  } catch (err: any) {
    console.error('[PROJECTS POST]', err);
    if (err.code === '23505') return NextResponse.json({ error: 'Un projet avec ce nom existe déjà' }, { status: 409 });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
