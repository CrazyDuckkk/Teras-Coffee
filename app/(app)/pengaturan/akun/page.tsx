import { PageHeader } from "@/components/layout/page-header";
import { KasirPanel } from "@/components/pengaturan/kasir-panel";
import { JamTutupKasirPanel } from "@/components/pengaturan/jam-tutup-kasir-panel";
import { listKasir } from "@/lib/queries/kasir";
import { requireRole } from "@/lib/auth-guard";
import {
  getPengaturanJamTutupKasir,
} from "@/lib/queries/tutup-kasir";

export default async function AkunKasirPage() {
  await requireRole("owner");
  const [kasir, pengaturanJamTutup] = await Promise.all([
    listKasir(),
    getPengaturanJamTutupKasir(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan"
        description="Kelola akun kasir dan jam penutupan otomatis"
      />
      <JamTutupKasirPanel pengaturan={pengaturanJamTutup} />
      <KasirPanel initialKasir={kasir} />
    </div>
  );
}
