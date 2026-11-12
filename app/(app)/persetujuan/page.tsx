import { PageHeader } from "@/components/layout/page-header";
import { PengajuanVoidList } from "@/components/transaksi/pengajuan-void-list";
import { listPengajuanVoidMenunggu } from "@/lib/queries/transaksi";
import { requireRole } from "@/lib/auth-guard";

export default async function PersetujuanPage() {
  await requireRole("owner");
  const data = await listPengajuanVoidMenunggu();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Persetujuan void" description="Tinjau dan putuskan pengajuan void dari kasir." />
      <PengajuanVoidList data={data} />
    </div>
  );
}
