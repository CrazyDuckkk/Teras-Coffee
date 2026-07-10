import { Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWIB } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { listRiwayatTutupKasir } from "@/lib/queries/tutup-kasir";

type Row = Awaited<ReturnType<typeof listRiwayatTutupKasir>>[number];

export function RiwayatTutupKasirList({ data }: { data: Row[] }) {
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada riwayat tutup kasir.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {data.map((row) => {
        const labaKotor = Number(row.labaKotor);
        return (
          <Card key={row.id} className="rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
            <CardContent className="flex flex-col gap-3 px-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium">{formatTanggalWIB(new Date(`${row.tanggal}T00:00:00`))}</span>
                {row.menuTerlarisNama && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Trophy className="size-3" />
                    {row.menuTerlarisNama}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Penjualan</span>
                  <Currency value={row.totalPenjualan} className="font-medium" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Pengeluaran</span>
                  <Currency value={row.totalPengeluaran} className="font-medium text-danger-foreground" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Laba Kotor</span>
                  <Currency
                    value={row.labaKotor}
                    className={cn("font-medium", labaKotor >= 0 ? "text-success-foreground" : "text-danger-foreground")}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
