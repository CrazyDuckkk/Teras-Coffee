"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { listTransaksiHariIni } from "@/lib/queries/transaksi";

type TransaksiRow = Awaited<ReturnType<typeof listTransaksiHariIni>>[number];

export function RiwayatTransaksi({ data }: { data: TransaksiRow[] }) {
  const router = useRouter();
  const [voidTarget, setVoidTarget] = useState<TransaksiRow | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleVoid() {
    if (!voidTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transaksi/${voidTarget.id}/void`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal void transaksi");
        return;
      }
      toast.success("Transaksi berhasil di-void, stok dikembalikan");
      setVoidTarget(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada transaksi hari ini.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {data.map((t) => (
        <Card key={t.id} className="rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          <CardContent className="flex items-center justify-between gap-3 px-4">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{formatTanggalWaktuWIB(new Date(t.tanggal))}</span>
                {t.status === "void" ? (
                  <Badge variant="destructive">Void</Badge>
                ) : (
                  <Badge className="bg-success text-success-foreground">Aktif</Badge>
                )}
                {t.metodeBayar === "hutang" && <Badge variant="outline">Hutang</Badge>}
              </div>
              <span className="text-xs text-muted-foreground">
                {t.items.map((i) => `${i.menuNama} x${i.qty}`).join(", ")}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Currency value={t.totalPemasukan} className="font-medium" />
              {t.status === "aktif" && (
                <Button variant="ghost" size="icon" aria-label="Void transaksi" onClick={() => setVoidTarget(t)}>
                  <Ban className="size-4 text-danger-foreground" />
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <AlertDialog open={voidTarget !== null} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Void transaksi ini?</AlertDialogTitle>
            <AlertDialogDescription>
              Stok bahan baku yang terpakai akan dikembalikan ke kondisi semula. Aksi ini tidak bisa dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={loading}>
              {loading ? "Memproses..." : "Void"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
