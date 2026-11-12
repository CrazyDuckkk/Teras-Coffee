"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { formatTanggalWaktuWIB, formatUmurMenit } from "@/lib/date";
import { tampilkanPeringatanEkspor } from "@/components/keuangan/export-warning";
import type { listPengajuanVoidMenunggu } from "@/lib/queries/transaksi";

type PengajuanVoidRow = Awaited<ReturnType<typeof listPengajuanVoidMenunggu>>[number];
type Keputusan = "setujui" | "tolak";

export function PengajuanVoidList({ data }: { data: PengajuanVoidRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ request: PengajuanVoidRow; keputusan: Keputusan } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDecision() {
    if (!target) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/pengajuan-void/${target.request.id}/keputusan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keputusan: target.keputusan }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal memproses pengajuan void");
        return;
      }

      toast.success(
        target.keputusan === "setujui"
          ? "Pengajuan disetujui, transaksi di-void dan stok dikembalikan"
          : "Pengajuan ditolak, transaksi kembali aktif"
      );
      tampilkanPeringatanEkspor(result.peringatanEkspor);
      setTarget(null);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {data.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          Tidak ada pengajuan void yang menunggu.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((request) => (
            <Card key={request.id} className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
              <CardContent className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">
                      {formatTanggalWaktuWIB(new Date(request.transaksi.tanggal))}
                    </span>
                    <Badge variant="outline">Menunggu void</Badge>
                    <Badge variant="outline">Menunggu {formatUmurMenit(request.umurMenit)}</Badge>
                    <Badge variant="outline">
                      {request.transaksi.metodeBayar === "qris"
                        ? "QRIS"
                        : request.transaksi.metodeBayar === "hutang"
                          ? "Hutang"
                          : "Tunai"}
                    </Badge>
                    <Currency value={request.transaksi.totalPemasukan} className="font-medium" />
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {request.transaksi.items
                      .map((item) => `${item.menuNama} x${item.qty}${item.bawaPulang ? " (bawa pulang)" : ""}`)
                      .join(", ")}
                  </span>
                  <span className="text-sm">Alasan: {request.alasan}</span>
                  <span className="text-xs text-muted-foreground">
                    Diajukan oleh {request.diajukanOlehNama ?? "akun yang tidak diketahui"} pada{" "}
                    {formatTanggalWaktuWIB(new Date(request.diajukanAt))}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setTarget({ request, keputusan: "tolak" })}>
                    Tolak
                  </Button>
                  <Button onClick={() => setTarget({ request, keputusan: "setujui" })}>Setujui</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={target !== null} onOpenChange={(open) => !open && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.keputusan === "setujui" ? "Setujui void transaksi?" : "Tolak pengajuan void?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.keputusan === "setujui"
                ? "Transaksi akan di-void dan stok yang dipakai dikembalikan."
                : "Transaksi akan kembali berstatus aktif dan tetap masuk perhitungan."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDecision} disabled={loading}>
              {loading ? "Memproses..." : target?.keputusan === "setujui" ? "Setujui" : "Tolak"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
