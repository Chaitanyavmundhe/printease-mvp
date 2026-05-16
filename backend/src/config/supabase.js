// Future Supabase client placeholder.
// Install @supabase/supabase-js before using this in production.

export function getSupabaseConfigStatus() {
  return {
    urlConfigured: Boolean(process.env.SUPABASE_URL),
    serviceKeyConfigured: Boolean(process.env.SUPABASE_SERVICE_KEY)
  };
}
