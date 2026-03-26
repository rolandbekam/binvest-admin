// src/middleware.ts
// Middleware de sécurité global — B-Invest Admin

import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_ROUTES = ['/', '/login', '/api/auth/login'];
const ADMIN_ROUTES = ['/admin', '/api/admin'];

// Clé secrète JWT (depuis variable d'env)
function getJWTSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET not configured');
  return new TextEncoder().encode(secret);
}

// ── Rate limiting simple en mémoire (remplacé par Redis en prod) ──
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(identifier: string, maxRequests = 100, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(identifier);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(identifier, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] ?? 'unknown';

  // ── 1. RATE LIMITING ──────────────────────────────────────────
  const isLoginRoute = pathname === '/api/auth/login';
  const rateLimit = isLoginRoute
    ? checkRateLimit(`login:${ip}`, 5, 15 * 60_000)   // 5 tentatives / 15 min pour login
    : checkRateLimit(`api:${ip}`, 200, 60_000);         // 200 req/min pour le reste

  if (!rateLimit) {
    return NextResponse.json(
      { error: 'Trop de requêtes. Veuillez patienter.' },
      {
        status: 429,
        headers: {
          'Retry-After': '900',
          'X-RateLimit-Limit': isLoginRoute ? '5' : '200',
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // ── 2. ROUTES PUBLIQUES ───────────────────────────────────────
  if (PUBLIC_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    return addSecurityHeaders(NextResponse.next());
  }

  // ── 3. PROTECTION ROUTES ADMIN ───────────────────────────────
  const isAdminRoute = ADMIN_ROUTES.some(r => pathname.startsWith(r));

  if (isAdminRoute) {
    const token = request.cookies.get('admin_token')?.value
      ?? request.headers.get('authorization')?.replace('Bearer ', '');

    if (!token) {
      // Redirect vers login si page, JSON si API
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
      }
      return NextResponse.redirect(new URL('/login', request.url));
    }

    try {
      const { payload } = await jwtVerify(token, getJWTSecret(), {
        algorithms: ['HS256'],
        issuer: 'binvest-admin',
        audience: 'binvest-admin-panel',
      });

      // Vérifier expiration
      if (!payload.exp || payload.exp < Date.now() / 1000) {
        throw new Error('Token expiré');
      }

      // Injecter les infos admin dans les headers (pour API Routes)
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-admin-id', payload.sub ?? '');
      requestHeaders.set('x-admin-role', String(payload.role ?? 'viewer'));
      requestHeaders.set('x-admin-email', String(payload.email ?? ''));
      requestHeaders.set('x-client-ip', ip);

      // Vérification rôle pour routes super_admin
      if (pathname.includes('/settings') || pathname.includes('/admin-users')) {
        if (payload.role !== 'super_admin') {
          if (pathname.startsWith('/api/')) {
            return NextResponse.json(
              { error: 'Accès refusé — Super Admin requis' },
              { status: 403 }
            );
          }
          return NextResponse.redirect(new URL('/admin/dashboard?error=forbidden', request.url));
        }
      }

      const response = NextResponse.next({ request: { headers: requestHeaders } });
      return addSecurityHeaders(response);

    } catch (err) {
      // Token invalide ou expiré
      const response = pathname.startsWith('/api/')
        ? NextResponse.json({ error: 'Session expirée. Veuillez vous reconnecter.' }, { status: 401 })
        : NextResponse.redirect(new URL('/login?reason=session_expired', request.url));

      // Supprimer le cookie invalide
      response.cookies.delete('admin_token');
      return response;
    }
  }

  return addSecurityHeaders(NextResponse.next());
}

function addSecurityHeaders(response: NextResponse): NextResponse {
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.png|.*\\.jpg|.*\\.svg).*)',
  ],
};
