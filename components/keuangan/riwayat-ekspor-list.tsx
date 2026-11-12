import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatTanggalWIB, formatTanggalWaktuWIB } from "@/lib/date";
import type { listRiwayatEksporLaporan } from "@/lib/queries/ekspor-laporan";

type EksporRow = Awaited<ReturnType<typeof listRiwayatEksporLaporan>>[number];

export function RiwayatEksporList({ data }: { data: EksporRow[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Riwayat Ekspor</CardTitle></CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Belum ada laporan yang diekspor.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((row) => (
              <div key={row.id} className="flex flex-col gap-1 border-b pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{row.periode === "mingguan" ? "Mingguan" : "Bulanan"} · {formatTanggalWIB(row.rentangMulai)}–{formatTanggalWIB(new Date(row.rentangSampai.getTime() - 1))}</span>
                  <span className="text-xs text-muted-foreground">{row.namaFile}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {row.dieksporOlehNama ?? "Akun tidak diketahui"} · {formatTanggalWaktuWIB(row.dieksporPada)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
