import { PageHeader } from "@/components/layout/page-header";
import { TutupKasirPanel } from "@/components/tutup-kasir/tutup-kasir-panel";
import { RiwayatTutupKasirList } from "@/components/tutup-kasir/riwayat-tutup-kasir-list";
import {
  getKasAwalTutupKasir,
  getTutupKasirHariIni,
  getTutupKasirHariIniKasir,
  listRiwayatTutupKasir,
} from "@/lib/queries/tutup-kasir";
import { requireRole } from "@/lib/auth-guard";

export default async function TutupKasirPage() {
  const session = await requireRole("owner", "cashier");
  if (session.user.role === "cashier") {
    const [penutupan, kasAwalSaran] = await Promise.all([
      getTutupKasirHariIniKasir(),
      getKasAwalTutupKasir(),
    ]);
    return <TutupKasirPanel penutupan={penutupan} kasAwalSaran={kasAwalSaran} />;
  }

  const [penutupan, kasAwalSaran, riwayat] = await Promise.all([
    getTutupKasirHariIni(),
    getKasAwalTutupKasir(),
    listRiwayatTutupKasir(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Tutup Kasir" description="Ringkasan harian dan riwayat tutup kasir" />
      <TutupKasirPanel penutupan={penutupan} kasAwalSaran={kasAwalSaran} />
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-foreground">Riwayat Tutup Kasir</h2>
        <RiwayatTutupKasirList data={riwayat} />
      </div>
    </div>
  );
}
