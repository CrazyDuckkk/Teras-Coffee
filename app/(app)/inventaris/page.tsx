import { PageHeader } from "@/components/layout/page-header";
import { listBahanBaku, listStokBahan, listStockMasuk } from "@/lib/queries/inventaris";
import { InventarisActions } from "@/components/inventaris/inventaris-actions";
import { BahanBakuTable } from "@/components/inventaris/bahan-baku-table";
import { StockMasukList } from "@/components/inventaris/stock-masuk-list";
import { StokBahanTable } from "@/components/inventaris/stok-bahan-table";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

export default async function InventarisPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role === "cashier") {
    const bahanBaku = await listStokBahan();
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Stok Bahan"
          description="Lihat stok bahan aktif dan catat Stock Masuk."
          actions={<InventarisActions bahanBaku={bahanBaku} isOwner={false} />}
        />
        <StokBahanTable data={bahanBaku} />
      </div>
    );
  }
  await requireRole("owner");

  const [bahanBaku, stockMasuk] = await Promise.all([listBahanBaku(true), listStockMasuk()]);
  const bahanBakuAktif = bahanBaku.filter((b) => b.isActive);
  const bahanBakuUntukStockMasuk = bahanBakuAktif.map(({ id, nama, satuan, stokSaatIni, batasMinimumStok }) => ({
    id,
    nama,
    satuan,
    stokSaatIni,
    batasMinimumStok,
  }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Inventaris"
        description="Kelola bahan baku, stock masuk, dan riwayat harga"
        actions={<InventarisActions bahanBaku={bahanBakuUntukStockMasuk} />}
      />
      <BahanBakuTable data={bahanBaku} />
      <StockMasukList data={stockMasuk} />
    </div>
  );
}
