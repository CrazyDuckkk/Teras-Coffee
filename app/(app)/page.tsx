import Link from "next/link";
import { TrendingUp, Coins, AlertTriangle, ShoppingCart, PackagePlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { Button } from "@/components/ui/button";
import { formatRupiah } from "@/lib/format";
import { getDashboardSummary } from "@/lib/queries/dashboard";
import { PeringatanInventaris } from "@/components/dashboard/peringatan-inventaris";
import { MenuTerlarisCard } from "@/components/dashboard/menu-terlaris-card";

export default async function DashboardPage() {
  const { omzetHariIni, labaKotorHariIni, stokMenipis, menuTerlaris } = await getDashboardSummary();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dashboard"
        description="Ringkasan operasional kedai hari ini"
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Omzet Hari Ini" value={formatRupiah(omzetHariIni)} icon={TrendingUp} />
        <StatCard label="Laba Kotor Hari Ini" value={formatRupiah(labaKotorHariIni)} icon={Coins} tone="success" />
        <StatCard
          label="Bahan Stok Menipis"
          value={String(stokMenipis.length)}
          icon={AlertTriangle}
          tone={stokMenipis.length > 0 ? "danger" : "default"}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PeringatanInventaris data={stokMenipis} />
        <MenuTerlarisCard data={menuTerlaris} />
      </div>
    </div>
  );
}
