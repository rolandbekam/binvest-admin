// src/lib/sudo.ts
// Client Sudo Africa — toutes les requêtes au partenaire passent par ce module.
// Doc officielle : https://docs.sudo.africa/
//
// IMPORTANT : ces clés vivent UNIQUEMENT côté serveur (Vercel env vars).
// Ne jamais les exposer au client (préfixe NEXT_PUBLIC_* interdit).

const SUDO_API_URL = process.env.SUDO_API_URL ?? 'https://api.sandbox.sudo.africa';
const SUDO_API_KEY = process.env.SUDO_API_KEY ?? '';
const SUDO_BUSINESS_ID = process.env.SUDO_BUSINESS_ID ?? '';

export class SudoError extends Error {
  status: number;
  body: any;
  constructor(message: string, status: number, body: any) {
    super(message);
    this.name = 'SudoError';
    this.status = status;
    this.body = body;
  }
}

export class SudoNotConfigured extends Error {
  constructor() {
    super('Sudo Africa non configuré (SUDO_API_KEY manquante)');
    this.name = 'SudoNotConfigured';
  }
}

export function isSudoConfigured(): boolean {
  return !!SUDO_API_KEY && !!SUDO_BUSINESS_ID;
}

async function sudoFetch<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!isSudoConfigured()) throw new SudoNotConfigured();

  const url = `${SUDO_API_URL}${path}`;
  const r = await fetch(url, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUDO_API_KEY}`,
      ...(init.headers ?? {}),
    },
  });

  const text = await r.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = { raw: text }; }

  if (!r.ok) {
    const msg = body?.message ?? body?.error ?? `Sudo HTTP ${r.status}`;
    throw new SudoError(msg, r.status, body);
  }
  return body as T;
}

// ─── CUSTOMERS ────────────────────────────────────────────────────────────────
// Sudo exige un customer (KYC) avant d'émettre une carte. On le crée à la
// première demande d'un user, puis on cache le customer_id dans profiles.

export interface SudoCustomerInput {
  type: 'individual';
  name: string;
  phoneNumber: string;
  emailAddress: string;
  status?: 'active';
  individual?: {
    firstName: string;
    lastName: string;
    dob: string;        // YYYY-MM-DD
    identity?: {
      type: 'BVN' | 'NIN' | 'PASSPORT' | 'DRIVERS_LICENSE';
      number: string;
    };
  };
  billingAddress?: {
    line1: string;
    city: string;
    state: string;
    postalCode?: string;
    country: string;     // ISO-2 : 'NG', 'CM'
  };
}

export interface SudoCustomer {
  _id: string;
  type: string;
  name: string;
  status: string;
  business: string;
  emailAddress: string;
  phoneNumber: string;
  createdAt: string;
}

export async function createCustomer(input: SudoCustomerInput): Promise<SudoCustomer> {
  const r = await sudoFetch<{ data: SudoCustomer }>('/customers', {
    method: 'POST',
    body: JSON.stringify({ ...input, business: SUDO_BUSINESS_ID }),
  });
  return r.data;
}

export async function getCustomer(customerId: string): Promise<SudoCustomer> {
  const r = await sudoFetch<{ data: SudoCustomer }>(`/customers/${customerId}`);
  return r.data;
}

// ─── CARDS ────────────────────────────────────────────────────────────────────
export interface SudoCardInput {
  customerId: string;
  type: 'virtual';
  brand: 'Visa' | 'Mastercard' | 'Verve';
  currency: 'USD' | 'NGN';
  fundingSourceId?: string;     // pour les cartes liées à un wallet Sudo
  status?: 'active';
}

export interface SudoCard {
  _id: string;
  customer: string;
  business: string;
  type: string;
  brand: string;
  currency: string;
  status: string;
  maskedPan: string;            // ex: "•••• •••• •••• 1234"
  expiryMonth: string;          // "MM"
  expiryYear: string;           // "YYYY"
  balance?: number;
  createdAt: string;
}

export async function createCard(input: SudoCardInput): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>('/cards', {
    method: 'POST',
    body: JSON.stringify({ ...input, business: SUDO_BUSINESS_ID }),
  });
  return r.data;
}

export async function getCard(cardId: string): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>(`/cards/${cardId}`);
  return r.data;
}

export async function getCardBalance(cardId: string): Promise<{ balance: number; currency: string }> {
  const r = await sudoFetch<{ data: { availableBalance: number; currency: string } }>(`/cards/${cardId}/balance`);
  return { balance: r.data.availableBalance, currency: r.data.currency };
}

// ─── SECURE DATA (PAN/CVV — PCI compliant) ────────────────────────────────────
// Sudo retourne ces données via un endpoint dédié, à appeler en server-side
// uniquement (jamais persister, transmettre au mobile sur connexion HTTPS active).

export interface SudoSecureData {
  number: string;          // PAN complet
  cvv: string;
  expiryMonth: string;
  expiryYear: string;
  cardholderName: string;
}

export async function getCardSecureData(cardId: string): Promise<SudoSecureData> {
  // Selon la version Sudo, l'endpoint peut être /cards/:id/secure-data ou /cards/:id/token
  // Vérifier la doc actuelle : https://docs.sudo.africa/reference/get-card-pan
  const r = await sudoFetch<{ data: SudoSecureData }>(`/cards/${cardId}/secure-data`);
  return r.data;
}

// ─── ACTIONS CARTE ────────────────────────────────────────────────────────────
export async function fundCard(cardId: string, amount: number, currency: string): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>(`/cards/${cardId}/fund`, {
    method: 'POST',
    body: JSON.stringify({ amount, currency, debitAccountId: SUDO_BUSINESS_ID }),
  });
  return r.data;
}

export async function lockCard(cardId: string): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>(`/cards/${cardId}/lock`, { method: 'PUT' });
  return r.data;
}

export async function unlockCard(cardId: string): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>(`/cards/${cardId}/unlock`, { method: 'PUT' });
  return r.data;
}

export async function closeCard(cardId: string): Promise<SudoCard> {
  const r = await sudoFetch<{ data: SudoCard }>(`/cards/${cardId}/close`, { method: 'PUT' });
  return r.data;
}

// ─── WEBHOOK SIGNATURE VERIFICATION ───────────────────────────────────────────
// Sudo signe les webhooks avec HMAC-SHA256. Vérifier obligatoirement.
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(payload: string, signature: string | null): boolean {
  const secret = process.env.SUDO_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[Sudo] SUDO_WEBHOOK_SECRET non configuré — vérification de signature désactivée');
    return process.env.NODE_ENV !== 'production';  // accepte en dev seulement
  }
  if (!signature) return false;

  const computed = createHmac('sha256', secret).update(payload).digest('hex');

  // Comparaison sécurisée (resistant aux timing attacks)
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(computed));
  } catch {
    return false;
  }
}
