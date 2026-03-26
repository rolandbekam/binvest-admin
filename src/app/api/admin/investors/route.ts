// src/app/api/admin/investors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createAdminClient, auditLog, getAdminFromHeaders, hasPermission } from '@/lib/supabase';

const InvestorSchema = z.object({
  full_name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().optional(),
  country: z.string().default('CM'),
  nationality: z.string().optional(),
  id_type: z.string().optional(),
  id_number_encrypted: z.string().optional(),
  address: z.string().optional(),
  pic_member: z.boolean().default(false),
  pic_fee_paid: z.boolean().default(false),
  dia_signed: z.boolean().default(false),
  kyc_status: z.enum(['pending','in_review','approved','rejected']).default('pending'),
  risk_profile: z.enum(['conservative','moderate','aggressive']).default('moderate'),
  notes: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = supabase
      .from('investors')
      .select(`*, subscriptions_count:subscriptions(count)`)
      .order('created_at', { ascending: false });

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    return NextResponse.json({ investors: data });
  } catch (err) {
    console.error('[INVESTORS GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  if (!hasPermission(admin.role, 'write')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 });

  try {
    const body = await request.json();
    const parsed = InvestorSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'Données invalides', details: parsed.error.flatten() }, { status: 400 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('investors')
      .insert({ ...parsed.data, created_by: admin.id })
      .select()
      .single();

    if (error) throw error;

    await auditLog({
      adminId: admin.id, adminEmail: admin.email,
      action: 'investor.create', resourceType: 'investor', resourceId: data.id,
      newValues: { name: data.full_name, email: data.email },
      ipAddress: admin.ip, severity: 'info',
    });

    return NextResponse.json({ investor: data }, { status: 201 });
  } catch (err: any) {
    if (err.code === '23505') return NextResponse.json({ error: 'Cet email existe déjà' }, { status: 409 });
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
