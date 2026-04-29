import { createClient as createSupabaseClient, SupabaseClient } from "@supabase/supabase-js";

// Singleton — une seule instance partagée, session stockée en localStorage
// (plus fiable que les cookies sur Android PWA)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: SupabaseClient<any> | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createClient(): SupabaseClient<any> {
  if (!client) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client = createSupabaseClient<any>(
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
