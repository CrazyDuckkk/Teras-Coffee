import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { requireSession } from "@/lib/auth-guard";

// Semua halaman di sini baca data transaksional live (stok, transaksi, keuangan) langsung dari
// Postgres tiap request — WAJIB dynamic, jangan sampai di-prerender statis saat build (data beku).
export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Proxy hanya pemeriksaan cookie untuk UX; sesi dan status akun divalidasi ke DB di sini.
  const session = await requireSession();
  if (!session) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen min-w-0">
      <Sidebar role={session.user.role} />
      <div className="flex min-h-screen min-w-0 flex-1 flex-col">
        <MobileNav role={session.user.role} />
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
