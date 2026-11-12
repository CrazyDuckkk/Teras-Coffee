import { PageHeader } from "@/components/layout/page-header";
import {
  listBahanBaku,
  listMenuUntukPenyesuaian,
  listRiwayatPenyesuaianStok,
  listStokBahan,
  listStockMasuk,
} from "@/lib/queries/inventaris";
import { InventarisActions } from "@/components/inventaris/inventaris-actions";
import { BahanBakuTable } from "@/components/inventaris/bahan-baku-table";
import { StockMasukList } from "@/components/inventaris/stock-masuk-list";
import { StokBahanTable } from "@/components/inventaris/stok-bahan-table";
import { PenyesuaianStokList } from "@/components/inventaris/penyesuaian-stok-list";
import { requireRole, requireSession } from "@/lib/auth-guard";
import { redirect } from "next/navigation";

export default async function InventarisPage() {
  const session = await requireSession();
  if (!session) redirect("/login");
  if (session.user.role === "cashier") {
    const [bahanBaku, menuAktif, penyesuaian] = await Promise.all([
      listStokBahan(),
      listMenuUntukPenyesuaian(),
      listRiwayatPenyesuaianStok(),
    ]);
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          title="Stok Bahan"
          description="Lihat stok bahan aktif, catat Stock Masuk, dan penyesuaian stok."
          actions={<InventarisActions bahanBaku={bahanBaku} menuAktif={menuAktif} isOwner={false} />}
        />
        <StokBahanTable data={bahanBaku} />
        <PenyesuaianStokList data={penyesuaian} isOwner={false} />
      </div>
    );
  }
  await requireRole("owner");

  const [bahanBaku, stockMasuk, menuAktif, penyesuaian] = await Promise.all([
    listBahanBaku(true),
    listStockMasuk(),
    listMenuUntukPenyesuaian(),
    listRiwayatPenyesuaianStok(),
  ]);
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
        description="Kelola bahan baku, Stock Masuk, penyesuaian stok, dan opname."
        actions={<InventarisActions bahanBaku={bahanBakuUntukStockMasuk} menuAktif={menuAktif} />}
      />
      <BahanBakuTable data={bahanBaku} />
      <StockMasukList data={stockMasuk} />
      <PenyesuaianStokList data={penyesuaian} isOwner />
    </div>
  );
}
