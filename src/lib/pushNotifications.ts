// src/lib/pushNotifications.ts
// Helper pour envoyer des push notifications via Expo Push API
// Doc: https://docs.expo.dev/push-notifications/sending-notifications/

import { createAdminClient } from './supabase';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
  sound?: 'default' | null;
  badge?: number;
  channelId?: 'default' | 'momo' | 'budget';
}

interface ExpoPushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

/**
 * Envoie une push notification à un user via son user_id (auth UUID).
 * Lookup du push_token dans profiles.push_token. Silencieux si pas de token.
 *
 * @returns true si envoyé, false sinon. N'importe pas en cas d'échec
 *          (ne doit pas bloquer la logique métier appelante).
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload,
): Promise<boolean> {
  if (!userId) return false;

  try {
    const supabase = createAdminClient();
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token')
      .eq('id', userId)
      .maybeSingle();

    const token = profile?.push_token;
    if (!token || !token.startsWith('ExponentPushToken')) return false;

    const message = {
      to: token,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
      sound: payload.sound ?? 'default',
      ...(payload.badge != null ? { badge: payload.badge } : {}),
      ...(payload.channelId ? { channelId: payload.channelId } : {}),
    };

    const r = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-encoding': 'gzip, deflate',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(message),
    });

    if (!r.ok) return false;

    const json = await r.json();
    const ticket: ExpoPushTicket = json?.data;
    if (ticket?.status !== 'ok') {
      // Token expiré / invalide — on le supprime du profil pour éviter de retenter
      if (ticket?.details?.error === 'DeviceNotRegistered') {
        await supabase
          .from('profiles')
          .update({ push_token: null })
          .eq('id', userId);
      }
      return false;
    }
    return true;
  } catch (e) {
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[Push] sendPushToUser failed:', (e as Error).message);
    }
    return false;
  }
}

/**
 * Envoi en batch (max 100 par requête à Expo). Pour cron de masse.
 */
export async function sendPushBatch(
  recipients: Array<{ userId: string; payload: PushPayload }>,
): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  // Expo accepte jusqu'à 100 messages par requête
  const chunks: typeof recipients[] = [];
  for (let i = 0; i < recipients.length; i += 100) {
    chunks.push(recipients.slice(i, i + 100));
  }
  for (const chunk of chunks) {
    const results = await Promise.all(
      chunk.map(({ userId, payload }) => sendPushToUser(userId, payload)),
    );
    for (const ok of results) ok ? sent++ : failed++;
  }
  return { sent, failed };
}
