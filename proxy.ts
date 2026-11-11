import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts` (fungsi `middleware` -> `proxy`).
// Ini hanya cek keberadaan cookie sesi (cepat, tanpa query DB) untuk redirect UX;
// validitas sesi sesungguhnya tetap divalidasi lewat auth.api.getSession() di server.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicRoute = pathname === "/login";

  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie && !isPublicRoute) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

// Semua /api/* (bukan hanya api/auth) dikecualikan dari redirect-ke-login: route handler API
// sudah proteksi diri sendiri lewat requireSession() dan membalas 401 JSON yang konsisten,
// bukan redirect HTML — supaya fetch() di client tidak coba parse halaman /login sebagai JSON
// saat sesi kadaluarsa di tengah pemakaian SPA.
export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
