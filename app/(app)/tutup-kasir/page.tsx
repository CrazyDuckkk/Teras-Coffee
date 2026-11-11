import { PageHeader } from "@/components/layout/page-header";
import { TutupKasirPanel } from "@/components/tutup-kasir/tutup-kasir-panel";
import { RiwayatTutupKasirList } from "@/components/tutup-kasir/riwayat-tutup-kasir-list";
import {
  getRingkasanHarian,
  getRingkasanKasir,
  getStatusTutupKasir,
  getTutupKasirHariIni,
  listRiwayatTutupKasir,
} from "@/lib/queries/tutup-kasir";
import { requireRole } from "@/lib/auth-guard";
import { TutupKasirKasir } from "@/components/tutup-kasir/tutup-kasir-kasir";

export default async function TutupKasirPage() {
  const session = await requireRole("owner", "cashier");
  if (session.user.role === "cashier") {
    const [ringkasan, status] = await Promise.all([
      getRingkasanKasir(),
      getStatusTutupKasir(),
    ]);
    return <TutupKasirKasir totalPenjualan={ringkasan.totalPenjualan} sudahTutup={status !== null} />;
  }

  const [ringkasan, sudahTutup, riwayat] = await Promise.all([
    getRingkasanHarian(),
    getTutupKasirHariIni(),
    listRiwayatTutupKasir(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tutup Kasir" description="Ringkasan harian dan riwayat tutup kasir" />
      <TutupKasirPanel ringkasan={ringkasan} sudahTutup={sudahTutup} />
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Riwayat Tutup Kasir</h2>
        <RiwayatTutupKasirList data={riwayat} />
      </div>
    </div>
  );
}
