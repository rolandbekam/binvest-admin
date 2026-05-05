// src/lib/auth-user.ts
// Helper pour authentifier les requêtes provenant de l'app mobile (Bearer JWT Supabase).
// À distinguer de getAdminFromHeaders() qui est pour le panel admin web.

import { NextResponse } from 'next/server';
import { createAdminClient } from './supabase';

export interface MobileUser {
  id: string;
  email: string | null;
  phone: string | null;
}

export interface RequireUserResult {
  user: MobileUser | null;
  error: NextResponse | null;
}

/**
 * Vérifie le JWT Supabase envoyé par le mobile dans Authorization: Bearer <token>.
 * Retourne { user, error } — si error présent, retourner directement depuis la route.
 */
export async function requireUser(headers: Headers): Promise<RequireUserResult> {
  const auth = headers.get('Authorization') ?? headers.get('authorization');
  if (!auth) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Missing Authorization header' }, { status: 401 }),
    };
  }

  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return {
      user: null,
      error: NextResponse.json({ error: 'Empty bearer token' }, { status: 401 }),
    };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: error?.message ?? 'Invalid or expired token' },
        { status: 401 },
      ),
    };
  }

  return {
    user: {
      id: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
    },
    error: null,
  };
}

/**
 * Récupère ou crée le customer Sudo pour un user. Idempotent.
 * Retourne le sudo_customer_id (existing ou nouveau).
 */
export async function getOrCreateSudoCustomer(userId: string): Promise<string> {
  const supabase = createAdminClient();

  // 1. Check si on a déjà un customer_id
  const { data: profile } = await supabase
    .from('profiles')
    .select('sudo_customer_id, full_name, email, phone, country')
    .eq('id', userId)
    .maybeSingle();

  if (profile?.sudo_customer_id) {
    return profile.sudo_customer_id;
  }

  // 2. Récupérer les infos KYC pour Sudo
  const [{ data: investor }, { data: kyc }] = await Promise.all([
    supabase.from('investors').select('*').eq('user_id', userId).maybeSingle(),
    supabase.from('kyc_submissions').select('*').eq('user_id', userId)
      .eq('status', 'approved').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  if (!investor || investor.kyc_status !== 'approved') {
    throw new Error('KYC non approuvé — émission de carte impossible');
  }

  const fullName = profile?.full_name ?? investor.full_name ?? 'User';
  const [firstName, ...rest] = fullName.split(' ');
  const lastName = rest.join(' ') || firstName;

  // 3. Créer le customer chez Sudo
  const { createCustomer } = await import('./sudo');
  const customer = await createCustomer({
    type: 'individual',
    name: fullName,
    emailAddress: profile?.email ?? investor.email ?? `${userId}@buam.local`,
    phoneNumber: profile?.phone ?? investor.phone ?? '',
    individual: {
      firstName,
      lastName,
      dob: kyc?.date_of_birth ?? '1990-01-01',
      identity: kyc?.doc_number ? {
        type: (kyc.doc_type === 'passport' ? 'PASSPORT'
              : kyc.doc_type === 'national_id' ? 'NIN'
              : kyc.doc_type === 'drivers_license' ? 'DRIVERS_LICENSE'
              : 'BVN') as any,
        number: kyc.doc_number,
      } : undefined,
    },
    billingAddress: investor.address ? {
      line1: investor.address,
      city: investor.city ?? '',
      state: investor.state ?? '',
      country: (investor.country ?? 'NG').slice(0, 2).toUpperCase() as 'NG' | 'CM',
    } : undefined,
  });

  // 4. Cache le customer_id
  await supabase
    .from('profiles')
    .update({
      sudo_customer_id: customer._id,
      sudo_customer_status: customer.status,
    })
    .eq('id', userId);

  return customer._id;
}
