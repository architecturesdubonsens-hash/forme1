import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Singleton — une seule instance partagée, session stockée en localStorage
// (plus fiable que les cookies sur Android PWA)
let client: ReturnType<typeof createSupabaseClient> | null = null;

export function createClient() {
  if (!client) {
    client = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: typeof window !== "undefined" ? window.localStorage : undefined,
        },
      }
    );
  }
  return client;
}
