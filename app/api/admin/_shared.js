import { createClient } from "@supabase/supabase-js";

/**
 * Creates a Supabase client using the service role key — this bypasses
 * RLS entirely, which is exactly why it must only ever run server-side
 * (inside a Route Handler) and never be sent to the browser. The
 * SUPABASE_SERVICE_ROLE_KEY env var is deliberately NOT prefixed with
 * NEXT_PUBLIC_, which is what keeps Next.js from ever bundling it into
 * client-side code.
 */
export function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("Server is missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
}

/** Verifies the request's bearer token belongs to a real, currently signed-in user. */
export async function getCallerUser(request, admin) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.replace("Bearer ", "");
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) return null;
  return data.user;
}
