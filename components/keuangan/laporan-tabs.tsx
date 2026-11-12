import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Currency } from "@/components/shared/currency";
import { StatCard } from "@/components/shared/stat-card";
import { formatKategori } from "@/lib/format";
import { formatTanggalWIB, formatTanggalWaktuWIB } from "@/lib/date";
import type { getLaporanKeuangan } from "@/lib/queries/laporan-keuangan";

type LaporanData = Awaited<ReturnType<typeof getLaporanKeuangan>>;

function Ringkasan({ data }: { data: LaporanData }) {
  const { ringkasan } = data;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Laba Transaksi Lunas" value={<Currency value={ringkasan.labaDiakui} />} tone="success" />
        <StatCard label="Biaya Susut" value={<Currency value={ringkasan.biayaSusut} />} tone="danger" />
        <StatCard label="Dasar Bagi Hasil" value={<Currency value={ringkasan.dasarBagiHasil} />} tone={ringkasan.dasarBagiHasil >= 0 ? "success" : "danger"} />
        <StatCard label="Piutang Akhir Periode" value={<Currency value={ringkasan.totalPiutang} />} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Penjualan dan Arus Kas</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="flex justify-between gap-3 text-sm"><span>Tunai</span><Currency value={ringkasan.penjualanPerMetode.tunai} /></div>
            <div className="flex justify-between gap-3 text-sm"><span>QRIS</span><Currency value={ringkasan.penjualanPerMetode.qris} /></div>
            <div className="flex justify-between gap-3 text-sm"><span>Penjualan hutang</span><Currency value={ringkasan.penjualanPerMetode.hutang} /></div>
            <div className="flex justify-between gap-3 text-sm"><span>Pelunasan tunai / QRIS</span><Currency value={ringkasan.pembayaranHutang.total} /></div>
            <div className="flex justify-between gap-3 border-t pt-3 text-sm font-medium"><span>Uang masuk</span><Currency value={ringkasan.totalPemasukan} /></div>
            <div className="flex justify-between gap-3 border-t pt-3 text-sm font-medium"><span>Stock Masuk</span><Currency value={ringkasan.totalPengeluaran} /></div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Penutupan dan Penyesuaian</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <div className="flex justify-between gap-3 text-sm"><span>Selisih kas laci</span><Currency value={ringkasan.selisihKas} /></div>
            <div className="flex justify-between gap-3 text-sm"><span>Selisih QRIS</span><Currency value={ringkasan.selisihQris} /></div>
            <div className="flex justify-between gap-3 text-sm"><span>Hari tutup otomatis</span><span>{ringkasan.hariTutupOtomatis}</span></div>
            <div className="flex justify-between gap-3 text-sm"><span>Transaksi void</span><span>{ringkasan.jumlahVoid}</span></div>
            <p className="text-xs text-muted-foreground sm:col-span-2">
              Laba diakui saat transaksi lunas. Dasar bagi hasil = laba diakui − biaya susut; pengeluaran operasional lain belum dicatat di aplikasi.
            </p>
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Piutang pada Akhir Periode</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {data.piutang.length === 0 ? (
            <p className="py-5 text-center text-sm text-muted-foreground">Tidak ada piutang tersisa pada akhir periode.</p>
          ) : (
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead><tr className="border-b text-muted-foreground"><th className="py-2 font-medium">Pelanggan</th><th className="py-2 text-right font-medium">Total</th><th className="py-2 text-right font-medium">Dibayar</th><th className="py-2 text-right font-medium">Sisa</th><th className="py-2 text-right font-medium">Umur</th></tr></thead>
              <tbody>{data.piutang.map((row, i) => <tr key={`${row.namaPelanggan}-${i}`} className="border-b last:border-0"><td className="py-2">{row.namaPelanggan}</td><td className="py-2 text-right"><Currency value={row.jumlah} /></td><td className="py-2 text-right"><Currency value={row.dibayar} /></td><td className="py-2 text-right"><Currency value={row.sisa} /></td><td className="py-2 text-right">{row.umurHari} hari</td></tr>)}</tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function BukuKas({ data }: { data: LaporanData }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Buku Kas</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
        {data.bukuKas.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada arus kas pada periode ini.</p>
        ) : (
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead><tr className="border-b text-muted-foreground"><th className="py-2 font-medium">Waktu</th><th className="py-2 font-medium">Jenis</th><th className="py-2 font-medium">Metode / sumber</th><th className="py-2 font-medium">Rincian</th><th className="py-2 text-right font-medium">Jumlah</th><th className="py-2 font-medium">Pelaku</th></tr></thead>
            <tbody>{data.bukuKas.map((row) => <tr key={`${row.tipe}-${row.id}`} className="border-b last:border-0"><td className="whitespace-nowrap py-2">{formatTanggalWaktuWIB(row.tanggal)}</td><td className="py-2">{row.tipe === "pemasukan" ? "Masuk" : "Keluar"}</td><td className="py-2">{row.metode === "kas_laci" ? "Kas laci" : row.metode === "di_luar_laci" ? "Di luar laci" : row.metode.toUpperCase()}</td><td className="py-2">{row.deskripsi}</td><td className="py-2 text-right"><Currency value={row.jumlah} /></td><td className="py-2">{row.pelaku ?? "—"}</td></tr>)}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function KasHarian({ data, tutupKasirPanel }: { data: LaporanData; tutupKasirPanel: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      {tutupKasirPanel}
      <Card>
        <CardHeader><CardTitle className="text-base">Kas Harian</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead><tr className="border-b text-muted-foreground">
              <th className="py-2 font-medium">Tanggal</th><th className="py-2 text-right font-medium">Tunai</th><th className="py-2 text-right font-medium">QRIS</th><th className="py-2 text-right font-medium">Hutang</th><th className="py-2 text-right font-medium">Pelunasan</th><th className="py-2 text-right font-medium">Laba lunas</th><th className="py-2 text-right font-medium">Stock Masuk</th><th className="py-2 text-right font-medium">Susut</th><th className="py-2 text-right font-medium">Selisih kas</th><th className="py-2 text-right font-medium">Selisih QRIS</th><th className="py-2 font-medium">Status tutup</th>
            </tr></thead>
            <tbody>{data.kasHarian.map((row) => <tr key={row.tanggal} className="border-b last:border-0">
              <td className="whitespace-nowrap py-2">{formatTanggalWIB(new Date(`${row.tanggal}T00:00:00Z`))}</td><td className="py-2 text-right"><Currency value={row.penjualanTunai} /></td><td className="py-2 text-right"><Currency value={row.penjualanQris} /></td><td className="py-2 text-right"><Currency value={row.penjualanHutang} /></td><td className="py-2 text-right"><Currency value={row.pembayaranHutang} /></td><td className="py-2 text-right"><Currency value={row.labaDiakui} /></td><td className="py-2 text-right"><Currency value={row.stockMasuk} /></td><td className="py-2 text-right"><Currency value={row.susut} /></td><td className="py-2 text-right">{row.selisihKas === null ? "—" : <Currency value={row.selisihKas} />}</td><td className="py-2 text-right">{row.selisihQris === null ? "—" : <Currency value={row.selisihQris} />}</td><td className="whitespace-nowrap py-2">{row.statusTutup}</td>
            </tr>)}</tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

function Laporan({ data }: { data: LaporanData }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Performa Menu</CardTitle></CardHeader>
      <CardContent className="overflow-x-auto">
      <p className="mb-3 text-xs text-muted-foreground">Porsi, omzet, HPP, dan laba dihitung untuk transaksi yang labanya diakui pada periode terpilih.</p>
        {data.performaMenu.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Belum ada transaksi lunas pada periode ini.</p>
        ) : (
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead><tr className="border-b text-muted-foreground"><th className="py-2 font-medium">Menu</th><th className="py-2 font-medium">Kategori</th><th className="py-2 text-right font-medium">Makan di tempat</th><th className="py-2 text-right font-medium">Bawa pulang</th><th className="py-2 text-right font-medium">Omzet</th><th className="py-2 text-right font-medium">HPP</th><th className="py-2 text-right font-medium">Laba</th><th className="py-2 text-right font-medium">Margin</th></tr></thead>
            <tbody>{data.performaMenu.map((row) => <tr key={row.menuId} className="border-b last:border-0"><td className="py-2 font-medium">{row.nama}</td><td className="py-2">{formatKategori(row.kategori)}</td><td className="py-2 text-right">{row.porsiDineIn}</td><td className="py-2 text-right">{row.porsiBawaPulang}</td><td className="py-2 text-right"><Currency value={row.omzet} /></td><td className="py-2 text-right"><Currency value={row.hpp} /></td><td className="py-2 text-right"><Currency value={row.laba} /></td><td className="py-2 text-right">{row.marginPersen.toFixed(1)}%</td></tr>)}</tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

export function LaporanTabs({
  data,
  activeTab,
  tutupKasirPanel,
}: {
  data: LaporanData;
  activeTab: string;
  tutupKasirPanel: React.ReactNode;
}) {
  return (
    <Tabs defaultValue={activeTab}>
      <TabsList className="h-auto w-full flex-wrap justify-start">
        <TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
        <TabsTrigger value="buku-kas">Buku Kas</TabsTrigger>
        <TabsTrigger value="kas-harian">Kas Harian</TabsTrigger>
        <TabsTrigger value="laporan">Laporan</TabsTrigger>
      </TabsList>
      <TabsContent value="ringkasan"><Ringkasan data={data} /></TabsContent>
      <TabsContent value="buku-kas"><BukuKas data={data} /></TabsContent>
      <TabsContent value="kas-harian"><KasHarian data={data} tutupKasirPanel={tutupKasirPanel} /></TabsContent>
      <TabsContent value="laporan"><Laporan data={data} /></TabsContent>
    </Tabs>
  );
}
