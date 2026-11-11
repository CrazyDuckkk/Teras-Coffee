import { PageHeader } from "@/components/layout/page-header";
import { getKasirData, listTransaksiTujuhHari } from "@/lib/queries/transaksi";
import { Kasir } from "@/components/transaksi/kasir";
import { RiwayatTransaksi } from "@/components/transaksi/riwayat-transaksi";
import { requireRole } from "@/lib/auth-guard";

export default async function TransaksiPage() {
  const session = await requireRole("owner", "cashier");
  const [kasirData, riwayat] = await Promise.all([getKasirData(), listTransaksiTujuhHari()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Transaksi" description="Input penjualan dan void transaksi" />
      <Kasir {...kasirData} />
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Riwayat 7 Hari Terakhir</h2>
        <RiwayatTransaksi
          data={riwayat}
          currentUserId={session.user.id}
          canVoid={session.user.role === "owner"}
        />
      </div>
    </div>
  );
}
