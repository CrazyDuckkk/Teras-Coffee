import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge, stokStatus } from "@/components/shared/status-badge";
import type { getDashboardSummary } from "@/lib/queries/dashboard";

type StokMenipisRow = Awaited<ReturnType<typeof getDashboardSummary>>["stokMenipis"][number];

export function PeringatanInventaris({ data }: { data: StokMenipisRow[] }) {
  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader>
        <CardTitle className="text-base">Peringatan Inventaris</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Semua bahan baku dalam kondisi aman.</p>
        ) : (
          data.map((b) => {
            const { status, label } = stokStatus(Number(b.stokSaatIni), Number(b.batasMinimumStok));
            return (
              <div key={b.id} className="flex items-center justify-between text-sm">
                <span>{b.nama}</span>
                <div className="flex items-center gap-2">
                  <span className="font-stat tabular-nums text-muted-foreground">
                    {Number(b.stokSaatIni).toLocaleString("id-ID")} {b.satuan}
                  </span>
                  <StatusBadge status={status}>{label}</StatusBadge>
                </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
