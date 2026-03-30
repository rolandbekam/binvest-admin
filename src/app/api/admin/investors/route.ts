// @ts-nocheck
// src/app/api/admin/investors/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient, getAdminFromHeaders } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const kyc = searchParams.get('kyc_status');

    // Minimal select — no joins to avoid failures if dependent tables are missing
    let query = supabase
      .from('investors')
      .select('id, full_name, email, phone, country, kyc_status, subscription_status, subscription_end_date, pic_member, dia_signed, is_active, created_at')
      .order('created_at', { ascending: false });

    if (kyc) query = query.eq('kyc_status', kyc);
    if (search) {
      // Escape % and _ to prevent accidental wildcard injection
      const safe = search.replace(/%/g, '\\%').replace(/_/g, '\\_');
      query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return NextResponse.json({ investors: data ?? [] });
  } catch (err) {
    console.error('[INVESTORS GET]', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromHeaders(request.headers);
  if (!admin.id) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.full_name || !body.email) {
      return NextResponse.json({ error: 'Nom et email obligatoires' }, { status: 400 });
    }
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('investors')
      .insert({
        full_name: body.full_name,
        email: body.email.toLowerCase().trim(),
        phone: body.phone ?? null,
        country: body.country ?? 'CM',
        nationality: body.nationality ?? null,
        address: body.address ?? null,
        kyc_status: body.kyc_status ?? 'pending',
        pic_member: body.pic_member ?? false,
        dia_signed: body.dia_signed ?? false,
        notes: body.notes ?? null,
        // user_id links this investor to a Supabase Auth user (enables mobile app RLS)
        user_id: body.user_id ?? null,
      })
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ investor: data }, { status: 201 });
  } catch (err: any) {
    console.error('[INVESTORS POST]', err);
    if (err.code === '23505') return NextResponse.json({ error: 'Un investisseur avec cet email existe déjà' }, { status: 409 });
    return NextResponse.json({ error: err.message ?? 'Erreur serveur' }, { status: 500 });
  }
}
