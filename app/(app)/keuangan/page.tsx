import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/shared/stat-card";
import { formatRupiah } from "@/lib/format";
import { getKeuangan, type PeriodeKeuangan } from "@/lib/queries/keuangan";
import { PeriodeFilter } from "@/components/keuangan/periode-filter";
import { KeuanganList } from "@/components/keuangan/keuangan-list";

const VALID_PERIODE: PeriodeKeuangan[] = ["hari-ini", "7-hari", "30-hari", "semua"];

export default async function KeuanganPage({
  searchParams,
}: {
  searchParams: Promise<{ periode?: string }>;
}) {
  const { periode: periodeParam } = await searchParams;
  const periode: PeriodeKeuangan = VALID_PERIODE.includes(periodeParam as PeriodeKeuangan)
    ? (periodeParam as PeriodeKeuangan)
    : "30-hari";

  const { entries, totalPemasukan, totalPengeluaran, saldo } = await getKeuangan(periode);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Keuangan" description="Riwayat pemasukan dan pengeluaran" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Pemasukan" value={formatRupiah(totalPemasukan)} tone="success" />
        <StatCard label="Total Pengeluaran" value={formatRupiah(totalPengeluaran)} tone="danger" />
        <StatCard label="Saldo" value={formatRupiah(saldo)} tone={saldo >= 0 ? "success" : "danger"} />
      </div>
      <PeriodeFilter current={periode} />
      <KeuanganList entries={entries} />
    </div>
  );
}
