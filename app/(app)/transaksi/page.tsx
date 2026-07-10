import { PageHeader } from "@/components/layout/page-header";
import { getKasirData, listTransaksiHariIni } from "@/lib/queries/transaksi";
import { Kasir } from "@/components/transaksi/kasir";
import { RiwayatTransaksi } from "@/components/transaksi/riwayat-transaksi";

export default async function TransaksiPage() {
  const [kasirData, riwayat] = await Promise.all([getKasirData(), listTransaksiHariIni()]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="Transaksi" description="Input penjualan dan void transaksi" />
      <Kasir {...kasirData} />
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Riwayat Hari Ini</h2>
        <RiwayatTransaksi data={riwayat} />
      </div>
    </div>
  );
}
