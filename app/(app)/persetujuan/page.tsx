import { PageHeader } from "@/components/layout/page-header";
import { PengajuanVoidList } from "@/components/transaksi/pengajuan-void-list";
import { listPengajuanVoidMenunggu } from "@/lib/queries/transaksi";
import { listStockMasukMenungguKonfirmasi } from "@/lib/queries/inventaris";
import { StockMasukApprovalList } from "@/components/inventaris/stock-masuk-approval-list";
import { requireRole } from "@/lib/auth-guard";

export default async function PersetujuanPage() {
  await requireRole("owner");
  const [pengajuanVoid, stockMasuk] = await Promise.all([
    listPengajuanVoidMenunggu(),
    listStockMasukMenungguKonfirmasi(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Persetujuan" description="Tinjau pengajuan void dan harga Stock Masuk dari kasir." />
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Pengajuan void</h2>
        <PengajuanVoidList data={pengajuanVoid} />
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Konfirmasi harga Stock Masuk</h2>
        <StockMasukApprovalList data={stockMasuk} />
      </section>
    </div>
  );
}
