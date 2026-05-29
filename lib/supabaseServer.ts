import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Server-only Supabase client using the service_role key. Never import this from client code.
let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase 未配置：缺少 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY");
  }
  cached = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}

// API-route authorization. If APP_PASSWORD is set, the request must carry a matching
// x-app-password header; if it is not set, access is open (local/dev).
export function isAuthorized(request: Request): boolean {
  const required = process.env.APP_PASSWORD;
  if (!required) return true;
  const provided = request.headers.get("x-app-password");
  return provided === required;
}
