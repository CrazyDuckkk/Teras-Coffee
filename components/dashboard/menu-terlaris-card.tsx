import { Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function MenuTerlarisCard({ data }: { data: { nama: string; qty: number }[] }) {
  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader>
        <CardTitle className="text-base">Menu Terlaris Hari Ini</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Belum ada transaksi hari ini.</p>
        ) : (
          data.map((m, idx) => (
            <div key={m.nama} className="flex items-center gap-3">
              <div className="rounded-full bg-accent p-2.5 text-accent-foreground">
                {idx === 0 ? <Trophy className="size-5" /> : <span className="flex size-5 items-center justify-center text-sm font-semibold">{idx + 1}</span>}
              </div>
              <div className="flex flex-col">
                <span className="font-medium">{m.nama}</span>
                <span className="text-sm text-muted-foreground">Terjual {m.qty} porsi</span>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
