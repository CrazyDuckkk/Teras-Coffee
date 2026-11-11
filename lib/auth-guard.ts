import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/db";
import { user } from "@/db/schema/auth";
import type { UserRole } from "@/lib/roles";
import { roleCanAccess } from "@/lib/roles";

/**
 * Lapis kedua otorisasi (defense-in-depth) — proxy.ts cuma optimistic check
 * berbasis cookie (cepat, untuk UX), BUKAN satu-satunya gerbang. Helper ini
 * benar-benar memvalidasi sesi ke Better Auth/DB, dipanggil di dua tempat:
 * - app/(app)/layout.tsx (redirect ke /login kalau null)
 * - setiap API route handler protected (balas 401 JSON kalau null)
 * Pemeriksaan sesi, status aktif, dan peran untuk halaman dan API.
 */
export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return null;
  }

  // Jangan percaya role/status dari cookie session cache: baca nilai terkini dari DB
  // agar penonaktifan akun langsung berlaku untuk semua request berikutnya.
  const [account] = await db
    .select({ role: user.role, isActive: user.isActive })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1);

  if (!account?.isActive) return null;

  return {
    ...session,
    user: {
      ...session.user,
      role: account.role,
      isActive: account.isActive,
    },
  };
}

export type AppSession = NonNullable<Awaited<ReturnType<typeof requireSession>>>;

export async function requireRole(
  ...allowedRoles: [UserRole, ...UserRole[]]
): Promise<AppSession> {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (!roleCanAccess(session.user.role, allowedRoles)) forbidden();
  return session;
}

export type ApiRoleResult =
  | { ok: true; session: AppSession }
  | { ok: false; response: NextResponse };

export async function requireApiRole(
  ...allowedRoles: [UserRole, ...UserRole[]]
): Promise<ApiRoleResult> {
  const session = await requireSession();
  if (!session) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Belum login" }, { status: 401 }),
    };
  }

  if (!roleCanAccess(session.user.role, allowedRoles)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Akses ditolak" }, { status: 403 }),
    };
  }

  return { ok: true, session };
}
