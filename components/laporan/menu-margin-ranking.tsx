import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Currency } from "@/components/shared/currency";
import { formatKategori } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { MenuRanking } from "@/lib/queries/laporan";

export function MenuMarginRanking({ data }: { data: MenuRanking[] }) {
  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader>
        <CardTitle className="text-base">Menu Paling Untung / Boncos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>
        ) : (
          data.map((r) => {
            const untung = r.marginPerUnit >= 0;
            return (
              <div key={r.menuId} className="flex items-center justify-between gap-3 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{r.nama}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="w-fit">
                      {formatKategori(r.kategori)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{r.qtyTerjual} porsi terjual</span>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <Currency
                    value={r.marginPerUnit}
                    className={cn("font-medium", untung ? "text-success-foreground" : "text-danger-foreground")}
                  />
                  <span className={cn("text-xs", untung ? "text-success-foreground" : "text-danger-foreground")}>
                    {untung ? "Untung" : "Boncos"} {r.marginPercent.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
