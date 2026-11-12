"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Currency } from "@/components/shared/currency";
import { Button } from "@/components/ui/button";
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
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { listStockMasuk } from "@/lib/queries/inventaris";

type StockMasukRow = Awaited<ReturnType<typeof listStockMasuk>>[number];

export function StockMasukList({ data }: { data: StockMasukRow[] }) {
  const router = useRouter();
  const [target, setTarget] = useState<StockMasukRow | null>(null);
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  function closeDialog() {
    if (loading) return;
    setTarget(null);
    setAlasan("");
  }

  async function handleKoreksi() {
    if (!target) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/stock-masuk/${target.id}/koreksi`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal mengoreksi Stock Masuk");
        return;
      }

      toast.success("Stock Masuk dibatalkan. Catat ulang dengan nilai yang benar.");
      setTarget(null);
      setAlasan("");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Riwayat Stock Masuk</h2>
        <p className="text-sm text-muted-foreground">Entri yang dikoreksi tetap tersimpan sebagai jejak audit.</p>
      </div>
      {data.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          Belum ada Stock Masuk.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-card shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Bahan</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Harga / satuan</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Dibayar dari</TableHead>
                <TableHead>Status harga</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{formatTanggalWaktuWIB(new Date(row.tanggal))}</TableCell>
                  <TableCell>
                    <div className="font-medium">{row.bahanNama}</div>
                    <div className="text-xs text-muted-foreground">{row.pelakuNama ?? "Akun lama"}</div>
                  </TableCell>
                  <TableCell>
                    {Number(row.qty).toLocaleString("id-ID")} {row.satuan}
                  </TableCell>
                  <TableCell>
                    <Currency value={row.hargaBeli} />
                  </TableCell>
                  <TableCell>
                    <Currency value={row.totalPengeluaran} />
                  </TableCell>
                  <TableCell>
                    {row.dibayarDari === "kas_laci"
                      ? "Kas laci"
                      : row.dibayarDari === "di_luar_laci"
                        ? "Di luar laci"
                        : "Data lama"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={row.statusHarga === "menunggu" ? "outline" : "secondary"}>
                      {row.statusHarga === "menunggu"
                        ? "Menunggu"
                        : row.statusHarga === "disetujui"
                          ? "Disetujui"
                          : "Ditolak"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {row.dibatalkanAt ? (
                      <Badge variant="destructive">Dikoreksi</Badge>
                    ) : (
                      <Badge variant="outline">Aktif</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {row.dibatalkanAt ? null : row.dibayarDari ? (
                      <Button variant="outline" size="sm" onClick={() => setTarget(row)}>
                        Koreksi
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled
                        title="Entri lama belum mencatat sumber pembayaran dan belum bisa dikoreksi dengan aman."
                      >
                        Koreksi
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
      <AlertDialog open={target !== null} onOpenChange={(open) => !open && closeDialog()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Koreksi Stock Masuk?</AlertDialogTitle>
            <AlertDialogDescription>
              Entri akan dibatalkan dengan jejak audit. Stok dan pengeluaran akan dibalik; masukkan Stock Masuk baru
              untuk mencatat nilai yang benar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="alasan-koreksi-stock-masuk">Alasan koreksi</Label>
            <Input
              id="alasan-koreksi-stock-masuk"
              maxLength={500}
              required
              value={alasan}
              onChange={(event) => setAlasan(event.target.value)}
              placeholder="Contoh: jumlah pembelian salah dicatat"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleKoreksi} disabled={loading || alasan.trim().length < 3}>
              {loading ? "Memproses..." : "Batalkan dan koreksi"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
