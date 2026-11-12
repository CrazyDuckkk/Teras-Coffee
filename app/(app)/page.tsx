import Link from "next/link";
import { TrendingUp, Coins, AlertTriangle, ShoppingCart, PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { PerluPerhatianPanel } from "@/components/dashboard/perlu-perhatian";
import { MenuTerlarisCard } from "@/components/dashboard/menu-terlaris-card";
import { redirect } from "next/navigation";
import { requireSession, requireRole } from "@/lib/auth-guard";

export default async function DashboardPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role === "cashier") redirect("/transaksi");
  await requireRole("owner");

  const summary = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional kedai hari ini dan minggu ini"
        actions={
          <>
            <Button variant="outline" nativeButton={false} render={<Link href="/inventaris" />}>
              <PackagePlus className="size-4" />
              Stock Masuk
            </Button>
            <Button nativeButton={false} render={<Link href="/transaksi" />}>
              <ShoppingCart className="size-4" />
              Transaksi Baru
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Omzet Hari Ini" value={formatRupiah(summary.omzetHariIni)} icon={TrendingUp} />
        <StatCard label="Laba Diakui Hari Ini" value={formatRupiah(summary.labaDiakuiHariIni)} icon={Coins} tone="success" />
        <StatCard label="Omzet Minggu Ini" value={formatRupiah(summary.omzetMingguIni)} icon={TrendingUp} />
        <StatCard label="Laba Diakui Minggu Ini" value={formatRupiah(summary.labaDiakuiMingguIni)} icon={Coins} tone="success" />
        <StatCard
          label="Bahan Stok Menipis"
          value={String(summary.stokMenipis.length)}
          icon={AlertTriangle}
          tone={summary.stokMenipis.length > 0 ? "danger" : "default"}
        />
      </div>
      <PerluPerhatianPanel perhatian={summary.perhatian} stokMenipis={summary.stokMenipis} />
      <MenuTerlarisCard data={summary.menuTerlaris} />
    </div>
  );
}
