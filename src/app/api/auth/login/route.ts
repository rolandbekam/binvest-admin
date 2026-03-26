// src/app/api/auth/login/route.ts
// Endpoint de connexion sécurisé

import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { createHash } from 'crypto';
import { z } from 'zod';
import { createAdminClient, auditLog } from '@/lib/supabase';

const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court'),
});

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET!);
const SESSION_DURATION = 8 * 60 * 60; // 8 heures

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';
  const userAgent = request.headers.get('user-agent') ?? '';

  try {
    // ── 1. Validation input ──────────────────────────────────────
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
    }

    const parsed = LoginSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Données invalides', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { email, password } = parsed.data;
    const supabase = createAdminClient();

    // ── 2. Récupérer l'admin ─────────────────────────────────────
    const { data: admin, error: fetchError } = await supabase
      .from('admin_users')
      .select('id, email, full_name, role, is_active, login_attempts, locked_until, password_hash')
      .eq('email', email.toLowerCase())
      .single();

    // Message d'erreur identique pour éviter l'énumération des comptes
    const GENERIC_ERROR = 'Email ou mot de passe incorrect';

    if (fetchError || !admin) {
      await auditLog({
        action: 'auth.login.failed',
        resourceType: 'admin_user',
        newValues: { email, reason: 'user_not_found' },
        ipAddress: ip,
        userAgent,
        severity: 'warning',
      });
      // Délai artificiel pour ralentir les attaques
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    // ── 3. Vérifier si compte bloqué ─────────────────────────────
    if (!admin.is_active) {
      return NextResponse.json({ error: 'Compte désactivé. Contactez l\'administrateur.' }, { status: 403 });
    }

    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const minutesLeft = Math.ceil((new Date(admin.locked_until).getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Compte verrouillé. Réessayez dans ${minutesLeft} minute(s).` },
        { status: 423 }
      );
    }

    // ── 4. Vérifier mot de passe ─────────────────────────────────
    // En prod: utiliser bcrypt. Pour le setup initial, on vérifie contre un hash SHA256
    // Remplacez par bcrypt en production
    const passwordHash = createHash('sha256')
      .update(password + process.env.PASSWORD_PEPPER!)
      .digest('hex');

    const passwordValid = admin.password_hash === passwordHash;

    if (!passwordValid) {
      // Incrémenter les tentatives
      const newAttempts = (admin.login_attempts ?? 0) + 1;
      const lockedUntil = newAttempts >= 5
        ? new Date(Date.now() + 30 * 60 * 1000).toISOString() // 30 min de blocage
        : null;

      await supabase
        .from('admin_users')
        .update({ login_attempts: newAttempts, locked_until: lockedUntil })
        .eq('id', admin.id);

      await auditLog({
        adminId: admin.id,
        adminEmail: admin.email,
        action: 'auth.login.failed',
        resourceType: 'admin_user',
        resourceId: admin.id,
        newValues: { attempts: newAttempts, locked: !!lockedUntil },
        ipAddress: ip,
        userAgent,
        severity: newAttempts >= 3 ? 'critical' : 'warning',
      });

      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      return NextResponse.json({ error: GENERIC_ERROR }, { status: 401 });
    }

    // ── 5. Créer le JWT ──────────────────────────────────────────
    const tokenId = crypto.randomUUID();
    const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DURATION;

    const token = await new SignJWT({
      sub: admin.id,
      email: admin.email,
      name: admin.full_name,
      role: admin.role,
      jti: tokenId,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setIssuer('binvest-admin')
      .setAudience('binvest-admin-panel')
      .setExpirationTime(`${SESSION_DURATION}s`)
      .sign(JWT_SECRET);

    // ── 6. Enregistrer la session ────────────────────────────────
    const tokenHash = createHash('sha256').update(token).digest('hex');
    await supabase.from('admin_sessions').insert({
      admin_id: admin.id,
      token_hash: tokenHash,
      ip_address: ip,
      user_agent: userAgent,
      expires_at: new Date(expiresAt * 1000).toISOString(),
    });

    // ── 7. Reset tentatives + update last_login ──────────────────
    await supabase
      .from('admin_users')
      .update({
        login_attempts: 0,
        locked_until: null,
        last_login: new Date().toISOString(),
      })
      .eq('id', admin.id);

    // ── 8. Audit log succès ──────────────────────────────────────
    await auditLog({
      adminId: admin.id,
      adminEmail: admin.email,
      action: 'auth.login.success',
      resourceType: 'admin_session',
      ipAddress: ip,
      userAgent,
      severity: 'info',
    });

    // ── 9. Réponse avec cookie HttpOnly ──────────────────────────
    const response = NextResponse.json({
      success: true,
      admin: {
        id: admin.id,
        email: admin.email,
        name: admin.full_name,
        role: admin.role,
      },
    });

    response.cookies.set('admin_token', token, {
      httpOnly: true,         // Inaccessible au JavaScript client
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: SESSION_DURATION,
      path: '/',
    });

    return response;

  } catch (err) {
    console.error('[LOGIN] Erreur:', err);
    return NextResponse.json(
      { error: 'Erreur interne. Veuillez réessayer.' },
      { status: 500 }
    );
  }
}
