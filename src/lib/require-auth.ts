import { headers } from "next/headers";
import { auth } from "@/src/lib/auth";

/**
 * Returns the DB-validated better-auth session, or null when unauthenticated.
 *
 * Use this (not a cookie-presence check) as the authoritative gate on API
 * routes — `getSessionCookie` from better-auth only extracts the token string
 * and does not verify it.
 */
export async function getAuthSession() {
  return auth.api.getSession({ headers: await headers() });
}
