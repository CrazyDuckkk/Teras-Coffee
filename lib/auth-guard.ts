import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * Lapis kedua otorisasi (defense-in-depth) — proxy.ts cuma optimistic check
 * berbasis cookie (cepat, untuk UX), BUKAN satu-satunya gerbang. Helper ini
 * benar-benar memvalidasi sesi ke Better Auth/DB, dipanggil di dua tempat:
 * - app/(app)/layout.tsx (redirect ke /login kalau null)
 * - setiap API route handler protected (balas 401 JSON kalau null)
 * Tidak melakukan redirect/response sendiri — pemanggil yang memutuskan reaksinya.
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }
  return session;
}
