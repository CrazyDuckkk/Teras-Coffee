import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { listAktivitasTerbaru } from "@/lib/queries/aktivitas";

type Aktivitas = Awaited<ReturnType<typeof listAktivitasTerbaru>>[number];

export function LogAktivitasList({ data }: { data: Aktivitas[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Log Aktivitas</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">Belum ada aktivitas dengan data pelaku.</p>
        ) : (
          <ol className="flex flex-col">
            {data.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-2 border-b py-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{row.aksi}</Badge>
                    <span className="text-sm">{row.detail}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">{row.pelakuNama ?? "Akun tidak diketahui"}</span>
                </div>
                <time className="shrink-0 text-xs text-muted-foreground">
                  {formatTanggalWaktuWIB(row.waktu)}
                </time>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
