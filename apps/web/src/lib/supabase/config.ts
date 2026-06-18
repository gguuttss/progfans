// Supabase public config. Auth degrades gracefully: if these aren't set, the
// site still renders (unauthenticated) instead of crashing — so the catalog
// works before the anon key is wired in.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
