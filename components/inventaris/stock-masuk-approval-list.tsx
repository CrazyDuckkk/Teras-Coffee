"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Currency } from "@/components/shared/currency";
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
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { listStockMasukMenungguKonfirmasi } from "@/lib/queries/inventaris";

type StockMasukMenunggu = Awaited<ReturnType<typeof listStockMasukMenungguKonfirmasi>>[number];
type Keputusan = "setujui" | "tolak";

export function StockMasukApprovalList({ data }: { data: StockMasukMenunggu[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<{ row: StockMasukMenunggu; keputusan: Keputusan } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleDecision() {
    if (!target) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-masuk/${target.row.id}/harga/keputusan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keputusan: target.keputusan }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal memproses konfirmasi harga");
        return;
      }

      toast.success(
        target.keputusan === "setujui"
          ? "Harga disetujui dan berlaku untuk HPP berikutnya."
          : "Harga ditolak; harga aktif tetap digunakan."
      );
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
          Tidak ada harga Stock Masuk yang menunggu konfirmasi.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((row) => (
            <Card key={row.id} className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
              <CardContent className="flex flex-col gap-4 px-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{row.bahanNama}</span>
                    <Badge variant="outline">Menunggu konfirmasi harga</Badge>
                    <span className="text-sm">
                      {Number(row.qty).toLocaleString("id-ID")} {row.satuan}
                    </span>
                  </div>
                  <span className="text-sm">
                    <Currency value={row.hargaBeli} /> / {row.satuan}; total{" "}
                    <Currency value={row.totalPengeluaran} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Dibayar dari {row.dibayarDari === "kas_laci" ? "kas laci" : "luar laci"}; dicatat oleh{" "}
                    {row.pelakuNama ?? "akun yang tidak diketahui"} pada {formatTanggalWaktuWIB(new Date(row.tanggal))}
                  </span>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button variant="outline" onClick={() => setTarget({ row, keputusan: "tolak" })}>
                    Tolak harga
                  </Button>
                  <Button onClick={() => setTarget({ row, keputusan: "setujui" })}>Setujui harga</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      <AlertDialog open={target !== null} onOpenChange={(open) => !open && !loading && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {target?.keputusan === "setujui" ? "Setujui harga bahan?" : "Tolak usulan harga?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {target?.keputusan === "setujui"
                ? "Harga ini akan menjadi harga aktif untuk perhitungan HPP selanjutnya. Stok dan pengeluaran sudah dicatat."
                : "Stok dan pengeluaran tetap dicatat, tetapi harga aktif lama tetap digunakan."}
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
