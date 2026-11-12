import { PageHeader } from "@/components/layout/page-header";
import { PeriodeLaporanFilter } from "@/components/keuangan/periode-filter";
import { LaporanTabs } from "@/components/keuangan/laporan-tabs";
import { TutupKasirPanel } from "@/components/tutup-kasir/tutup-kasir-panel";
import {
  getKasAwalTutupKasir,
  getTutupKasirHariIni,
} from "@/lib/queries/tutup-kasir";
import { getLaporanKeuangan } from "@/lib/queries/laporan-keuangan";
import { buatRentangLaporan, type PeriodeLaporan } from "@/lib/laporan-keuangan-core";
import { requireRole } from "@/lib/auth-guard";

const VALID_TAB = ["ringkasan", "buku-kas", "kas-harian", "laporan"];

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string; tanggal?: string; tab?: string }>;
}) {
  await requireRole("owner");
  const params = await searchParams;
  const periode: PeriodeLaporan = params.periode === "mingguan" ? "mingguan" : "bulanan";
  const tanggal = periode === "bulanan" && /^\d{4}-\d{2}$/.test(params.tanggal ?? "")
    ? `${params.tanggal}-01`
    : params.tanggal;
  const range = buatRentangLaporan(periode, tanggal);
  const activeTab = params.tab && VALID_TAB.includes(params.tab) ? params.tab : "ringkasan";

  const [data, penutupan, kasAwalSaran] = await Promise.all([
    getLaporanKeuangan(range),
    getTutupKasirHariIni(),
    getKasAwalTutupKasir(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Keuangan" description="Ringkasan, buku kas, kas harian, dan laporan terpadu" />
      <PeriodeLaporanFilter periode={periode} tanggal={range.tanggalAcuan} />
      <p className="text-sm text-muted-foreground">
        Periode WIB: {range.tanggalMulai} sampai {range.tanggalAkhir}
      </p>
      <LaporanTabs
        data={data}
        activeTab={activeTab}
        tutupKasirPanel={<TutupKasirPanel penutupan={penutupan} kasAwalSaran={kasAwalSaran} />}
      />
    </div>
  );
}
