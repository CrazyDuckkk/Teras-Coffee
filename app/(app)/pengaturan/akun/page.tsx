import { PageHeader } from "@/components/layout/page-header";
import { KasirPanel } from "@/components/pengaturan/kasir-panel";
import { listKasir } from "@/lib/queries/kasir";
import { requireRole } from "@/lib/auth-guard";

export default async function AkunKasirPage() {
  await requireRole("owner");
  const kasir = await listKasir();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Pengaturan Akun"
        description="Buat akun kasir dan kelola akses mereka"
      />
      <KasirPanel initialKasir={kasir} />
    </div>
  );
}
