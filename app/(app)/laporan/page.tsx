import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatRupiah } from "@/lib/format";
import { getLaporan, type PeriodeLaporan } from "@/lib/queries/laporan";
import { LaporanPeriodeFilter } from "@/components/laporan/periode-filter";
import { MenuTerlarisRanking } from "@/components/laporan/menu-terlaris-ranking";
import { MenuMarginRanking } from "@/components/laporan/menu-margin-ranking";
import { requireRole } from "@/lib/auth-guard";

const VALID_PERIODE: PeriodeLaporan[] = ["harian", "mingguan", "bulanan"];

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  await requireRole("owner");
  const { periode: periodeParam } = await searchParams;
  const periode: PeriodeLaporan = VALID_PERIODE.includes(periodeParam as PeriodeLaporan)
    ? (periodeParam as PeriodeLaporan)
    : "harian";

  const { totalPemasukan, totalPengeluaran, labaRugi, menuTerlaris, menuMargin, kategoriList } =
    await getLaporan(periode);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Laporan" description="Laba-Rugi, Menu Terlaris, dan Menu Paling Untung/Boncos" />
      <LaporanPeriodeFilter current={periode} />
      <p className="text-sm text-muted-foreground">
        {periode === "harian"
          ? "Periode hari ini menggunakan zona waktu WIB."
          : periode === "mingguan"
            ? "Periode mingguan berjalan dari Senin hingga Senin berikutnya (WIB)."
            : "Periode bulanan berjalan dari tanggal 1 hingga tanggal 1 bulan berikutnya (WIB)."}
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatRupiah(totalPemasukan)} tone="success" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(totalPengeluaran)} tone="danger" />
        <StatCard label="Laba Rugi" value={formatRupiah(labaRugi)} tone={labaRugi >= 0 ? "success" : "danger"} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <MenuTerlarisRanking data={menuTerlaris} kategoriList={kategoriList} />
        <MenuMarginRanking data={menuMargin} />
      </div>
    </div>
  );
}
