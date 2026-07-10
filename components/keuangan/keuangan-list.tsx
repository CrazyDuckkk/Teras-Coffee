import { ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import { cn } from "@/lib/utils";
import type { KeuanganEntry } from "@/lib/queries/keuangan";

export function KeuanganList({ entries }: { entries: KeuanganEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada data keuangan pada periode ini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {entries.map((entry) => {
        const isPemasukan = entry.tipe === "pemasukan";
        return (
          <Card key={`${entry.tipe}-${entry.id}`} className="rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
            <CardContent className="flex items-center justify-between gap-3 px-4">
              <div className="flex items-center gap-3">
                {isPemasukan ? (
                  <ArrowUpCircle className="size-5 shrink-0 text-success-foreground" />
                ) : (
                  <ArrowDownCircle className="size-5 shrink-0 text-danger-foreground" />
                )}
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{entry.deskripsi}</span>
                  <span className="text-xs text-muted-foreground">{formatTanggalWaktuWIB(new Date(entry.tanggal))}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={isPemasukan ? "bg-success text-success-foreground" : "bg-danger text-danger-foreground"}>
                  {isPemasukan ? "Pemasukan" : "Pengeluaran"}
                </Badge>
                <Currency
                  value={entry.jumlah}
                  className={cn("font-medium", isPemasukan ? "text-success-foreground" : "text-danger-foreground")}
                />
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
