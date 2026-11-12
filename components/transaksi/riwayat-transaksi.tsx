"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Textarea } from "@/components/ui/textarea";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { listTransaksiTujuhHari } from "@/lib/queries/transaksi";

type TransaksiRow = Awaited<ReturnType<typeof listTransaksiTujuhHari>>[number];

export function RiwayatTransaksi({
  data,
  currentUserId,
  canVoid,
}: {
  data: TransaksiRow[];
  currentUserId: string;
  canVoid: boolean;
}) {
  const router = useRouter();
  const [voidTarget, setVoidTarget] = useState<TransaksiRow | null>(null);
  const [loading, setLoading] = useState(false);
  const [alasan, setAlasan] = useState("");

  async function handleVoid() {
    if (!voidTarget || !alasan.trim()) return;
    setLoading(true);
    try {
      const endpoint = canVoid
        ? `/api/transaksi/${voidTarget.id}/void`
        : `/api/transaksi/${voidTarget.id}/pengajuan-void`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal void transaksi");
        return;
      }
      toast.success(
        canVoid
          ? "Transaksi berhasil di-void, stok dikembalikan"
          : "Pengajuan void dikirim ke owner"
      );
      setVoidTarget(null);
      setAlasan("");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const milikSaya = data.filter((transaction) => transaction.pelakuId === currentUserId);
  const milikKasirLain = data.filter((transaction) => transaction.pelakuId !== currentUserId);

  function renderTransactions(transactions: TransaksiRow[], emptyMessage: string) {
    if (transactions.length === 0) {
      return (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          {emptyMessage}
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-3">
        {transactions.map((t) => (
          <Card key={t.id} className="rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
            <CardContent className="flex items-center justify-between gap-3 px-4">
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{formatTanggalWaktuWIB(new Date(t.tanggal))}</span>
                  {t.status === "void" ? (
                    <Badge variant="destructive">Void</Badge>
                  ) : t.status === "menunggu_void" ? (
                    <Badge variant="outline">Menunggu void</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground">Aktif</Badge>
                  )}
                  <Badge variant="outline">
                    {t.metodeBayar === "qris" ? "QRIS" : t.metodeBayar === "hutang" ? "Hutang" : "Tunai"}
                  </Badge>
                  {t.setelahTutup && <Badge variant="outline">Setelah tutup</Badge>}
                </div>
                <span className="text-xs text-muted-foreground">
                  {t.items
                    .map((i) => `${i.menuNama} x${i.qty}${i.bawaPulang ? " (bawa pulang)" : ""}`)
                    .join(", ")}
                </span>
                {t.pelakuId !== currentUserId && (
                  <span className="text-xs text-muted-foreground">
                    Kasir: {t.pelakuNama ?? "Tidak diketahui"}
                  </span>
                )}
                {t.pengajuanVoid && (
                  <span className="text-xs text-muted-foreground">
                    Alasan pengajuan: {t.pengajuanVoid.alasan}
                    {t.pengajuanVoid.diajukanOlehNama
                      ? ` — ${t.pengajuanVoid.diajukanOlehNama}`
                      : ""}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <Currency value={t.totalPemasukan} className="font-medium" />
                {t.status === "aktif" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={canVoid ? "Void transaksi" : "Ajukan void transaksi"}
                    onClick={() => {
                      setAlasan("");
                      setVoidTarget(t);
                    }}
                  >
                    <Ban className="size-4 text-danger-foreground" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <Tabs defaultValue="saya">
      <TabsList className="w-full sm:w-fit">
        <TabsTrigger value="saya">Transaksi saya ({milikSaya.length})</TabsTrigger>
        <TabsTrigger value="kasir-lain">Kasir lain ({milikKasirLain.length})</TabsTrigger>
      </TabsList>
      <TabsContent value="saya">
        {renderTransactions(milikSaya, "Belum ada transaksi Anda dalam 7 hari terakhir.")}
      </TabsContent>
      <TabsContent value="kasir-lain">
        {renderTransactions(milikKasirLain, "Belum ada transaksi kasir lain dalam 7 hari terakhir.")}
      </TabsContent>
      <AlertDialog open={voidTarget !== null} onOpenChange={(open) => !open && setVoidTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{canVoid ? "Void transaksi ini?" : "Ajukan void transaksi?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {canVoid
                ? "Stok bahan baku yang terpakai akan dikembalikan. Alasan void wajib diisi."
                : "Transaksi tetap dihitung dan stok tidak berubah sampai owner menyetujui pengajuan ini."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            aria-label="Alasan void"
            placeholder="Tuliskan alasan"
            maxLength={500}
            value={alasan}
            onChange={(event) => setAlasan(event.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleVoid} disabled={loading || !alasan.trim()}>
              {loading ? "Memproses..." : canVoid ? "Void" : "Kirim pengajuan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Tabs>
  );
}
