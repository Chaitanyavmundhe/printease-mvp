import { createClient } from '@supabase/supabase-js';

export function getSupabaseConfigStatus() {
  return {
    urlConfigured: Boolean(process.env.SUPABASE_URL),
    serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_KEY),
    bucketConfigured: Boolean(process.env.SUPABASE_BUCKET)
  };
}

export function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceKey) {
    throw new Error('Supabase Storage is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_KEY.');
  }

  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export function getSupabaseBucketName() {
  return process.env.SUPABASE_BUCKET || 'documents';
}
