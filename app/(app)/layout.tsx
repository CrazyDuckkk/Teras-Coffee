import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireSession } from "@/lib/auth-guard";

// Semua halaman di sini baca data transaksional live (stok, transaksi, keuangan) langsung dari
// Postgres tiap request — WAJIB dynamic, jangan sampai di-prerender statis saat build (data beku).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Lapis kedua otorisasi (defense-in-depth) — proxy.ts cuma optimistic check berbasis
  // cookie; ini validasi sesungguhnya ke Better Auth/DB, jaring pengaman kalau proxy
  // ter-bypass/salah matcher/ter-nonaktifkan. Menjaga ke-7 halaman di bawah layout ini sekaligus.
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex min-h-screen flex-1 flex-col">
        <MobileNav />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
