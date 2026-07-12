import { PageHeader } from "@/components/layout/page-header";
import { listBahanBaku } from "@/lib/queries/inventaris";
import { InventarisActions } from "@/components/inventaris/inventaris-actions";
import { BahanBakuTable } from "@/components/inventaris/bahan-baku-table";

export default async function InventarisPage() {
  const bahanBaku = await listBahanBaku(true);
  const bahanBakuAktif = bahanBaku.filter((b) => b.isActive);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventaris"
        description="Kelola bahan baku, stock masuk, dan riwayat harga"
        actions={<InventarisActions bahanBaku={bahanBakuAktif} />}
      />
      <BahanBakuTable data={bahanBaku} />
    </div>
  );
}
