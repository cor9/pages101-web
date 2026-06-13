import { createClient, type SupabaseClient } from "@supabase/supabase-js";

type Pages101Database = {
  pages101: {
    Tables: Record<
      string,
      {
        Row: Record<string, unknown>;
        Insert: Record<string, unknown>;
        Update: Record<string, unknown>;
        Relationships: [];
      }
    >;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

let publicClient: SupabaseClient<Pages101Database, "pages101"> | null = null;

export function getSupabasePublicClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  if (!publicClient) {
    publicClient = createClient<Pages101Database, "pages101">(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: "pages101"
      }
    });
  }

  return publicClient;
}

/**
 * Service-role client for server-side routes that need to bypass RLS
 * (Stripe webhook upserts, Resume101 import, etc.)
 */
export function createSupabaseServiceClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Reads the authenticated user from a cookie-based session token passed in headers.
 * Used by API routes that need to know who is signed in (checkout, portal, import).
 */
export function createSupabaseServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  // In API routes we use the anon key; the JWT from the cookie is forwarded
  // via a global cookie adapter. For now this returns a simple anon client —
  // callers must pass the Authorization header from the client or use service role.
  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}
