import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;
let cachedKeySignature = '';

function cleanEnv(val?: string): string {
  return (val || '').trim().replace(/^["']|["']$/g, '').trim();
}

export function isSupabaseConfigured(): boolean {
  const url = cleanEnv(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return Boolean(
    url &&
      key &&
      url.startsWith('https://') &&
      !url.includes('MY_SUPABASE_URL') &&
      !key.includes('MY_SUPABASE_SERVICE_ROLE_KEY')
  );
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;

  const url = cleanEnv(process.env.SUPABASE_URL);
  const key = cleanEnv(process.env.SUPABASE_SERVICE_ROLE_KEY);
  const sig = `${url}::${key.slice(0, 12)}`;

  if (!cachedClient || cachedKeySignature !== sig) {
    cachedClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    cachedKeySignature = sig;
  }

  return cachedClient;
}
