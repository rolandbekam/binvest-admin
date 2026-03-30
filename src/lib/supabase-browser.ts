// src/lib/supabase-browser.ts
// Client-side Supabase client (anon key) — used ONLY for Realtime subscriptions.
// Data fetching goes through API routes (service role).

import { createClient, SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient | null {
  if (_client) return _client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    // Realtime not available without anon key — fall back to polling
    return null;
  }

  _client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    realtime: { params: { eventsPerSecond: 2 } },
  });

  return _client;
}
