import Link from "next/link";
import { AlertTriangle, ClipboardCheck, Clock3, Wallet } from "lucide-react";
import { Currency } from "@/components/shared/currency";
import { PeringatanInventaris } from "@/components/dashboard/peringatan-inventaris";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTanggalWIB, formatUmurMenit } from "@/lib/date";
import type { getDashboardSummary } from "@/lib/queries/dashboard";

type DashboardData = Awaited<ReturnType<typeof getDashboardSummary>>;

function formatTanggal(tanggal: string) {
  return formatTanggalWIB(new Date(`${tanggal}T00:00:00+07:00`));
}

export function PerluPerhatianPanel({
  perhatian,
  stokMenipis,
}: {
  perhatian: DashboardData["perhatian"];
  stokMenipis: DashboardData["stokMenipis"];
}) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Perlu Perhatian</h2>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="size-4" />
              Persetujuan menunggu
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Link href="/persetujuan" className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-accent">
              <span className="text-sm">Void</span>
              <span className="flex items-center gap-2 text-sm">
                <Badge variant={perhatian.pengajuanVoid.jumlah ? "destructive" : "secondary"}>
                  {perhatian.pengajuanVoid.jumlah}
                </Badge>
                <span className="text-muted-foreground">
                  tertua {formatUmurMenit(perhatian.pengajuanVoid.umurTertuaMenit)}
                </span>
              </span>
            </Link>
            <Link href="/persetujuan" className="flex items-center justify-between gap-3 rounded-md border p-3 hover:bg-accent">
              <span className="text-sm">Harga Stock Masuk</span>
              <span className="flex items-center gap-2 text-sm">
                <Badge variant={perhatian.konfirmasiHarga.jumlah ? "destructive" : "secondary"}>
                  {perhatian.konfirmasiHarga.jumlah}
                </Badge>
                <span className="text-muted-foreground">
                  tertua {formatUmurMenit(perhatian.konfirmasiHarga.umurTertuaMenit)}
                </span>
              </span>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock3 className="size-4" />
              Tutup kasir minggu ini
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {perhatian.tutupOtomatis.length === 0 && perhatian.selisihKasir.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada tutup otomatis atau selisih kas/QRIS minggu ini.</p>
            ) : (
              <>
                {perhatian.tutupOtomatis.map((tanggal) => (
                  <Link
                    key={`auto-${tanggal}`}
                    href="/keuangan?tab=kas-harian"
                    className="flex items-center justify-between gap-3 text-sm hover:underline"
                  >
                    <span>Belum diverifikasi · {formatTanggal(tanggal)}</span>
                    <Badge variant="outline">Otomatis</Badge>
                  </Link>
                ))}
                {perhatian.selisihKasir.map((row) => (
                  <Link
                    key={`selisih-${row.tanggal}`}
                    href="/keuangan?tab=kas-harian"
                    className="flex items-center justify-between gap-3 text-sm hover:underline"
                  >
                    <span className="flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-600" />
                      {formatTanggal(row.tanggal)}
                    </span>
                    <span className="flex flex-wrap justify-end gap-x-3">
                      {row.selisihKas !== 0 && <span>Kas <Currency value={row.selisihKas} /></span>}
                      {row.selisihQris !== 0 && <span>QRIS <Currency value={row.selisihQris} /></span>}
                    </span>
                  </Link>
                ))}
              </>
            )}
          </CardContent>
        </Card>

        <PeringatanInventaris data={stokMenipis} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between gap-3 text-base">
              <span className="flex items-center gap-2">
                <Wallet className="size-4" />
                Hutang lama ({perhatian.hutangLama.ambangHari}+ hari)
              </span>
              <Badge variant={perhatian.hutangLama.jumlah ? "destructive" : "secondary"}>
                {perhatian.hutangLama.jumlah}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {perhatian.hutangLama.daftar.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Tidak ada piutang tersisa yang berumur {perhatian.hutangLama.ambangHari} hari atau lebih.
              </p>
            ) : (
              <>
                {perhatian.hutangLama.daftar.map((row) => (
                  <Link
                    key={row.id}
                    href="/hutang"
                    className="flex items-center justify-between gap-3 text-sm hover:underline"
                  >
                    <span>{row.namaPelanggan ?? "Tanpa nama"} · {row.umurHari} hari</span>
                    <Currency value={row.sisa} />
                  </Link>
                ))}
                {perhatian.hutangLama.jumlah > perhatian.hutangLama.daftar.length && (
                  <Link href="/hutang" className="text-xs text-muted-foreground hover:underline">
                    Lihat {perhatian.hutangLama.jumlah - perhatian.hutangLama.daftar.length} lainnya
                  </Link>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
