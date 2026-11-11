"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalculatorIcon, CheckCircle2, Trophy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { formatTanggalWIB } from "@/lib/date";
import type { RingkasanHarian } from "@/lib/queries/tutup-kasir";

interface SudahTutup {
  tanggal: string;
  totalPenjualan: string;
  totalPengeluaran: string;
  labaKotor: string;
  menuTerlarisNama: string | null;
}

export function TutupKasirPanel({
  ringkasan,
  sudahTutup,
}: {
  ringkasan: RingkasanHarian;
  sudahTutup: SudahTutup | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleTutupKasir() {
    setLoading(true);
    try {
      const res = await fetch("/api/tutup-kasir", { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menutup kasir");
        return;
      }
      toast.success("Kasir hari ini berhasil ditutup");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const penjualan = sudahTutup ? Number(sudahTutup.totalPenjualan) : ringkasan.totalPenjualan;
  const pengeluaran = sudahTutup ? Number(sudahTutup.totalPengeluaran) : ringkasan.totalPengeluaran;
  const labaKotor = sudahTutup ? Number(sudahTutup.labaKotor) : ringkasan.labaKotor;
  const menuTerlarisNama = sudahTutup ? sudahTutup.menuTerlarisNama : ringkasan.menuTerlaris?.nama ?? null;
  const menuTerlarisQty = sudahTutup ? null : ringkasan.menuTerlaris?.qty ?? null;

  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Data Harian — {formatTanggalWIB(new Date())}</CardTitle>
        {sudahTutup ? (
          <Badge className="bg-success text-success-foreground">
            <CheckCircle2 className="size-3" />
            Sudah Ditutup
          </Badge>
        ) : (
          <Badge variant="outline">Belum Ditutup</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total Penjualan</span>
            <Currency value={penjualan} className="text-xl font-semibold" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Total Pengeluaran</span>
            <Currency value={pengeluaran} className="text-xl font-semibold text-danger-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-sm text-muted-foreground">Laba Kotor</span>
            <Currency
              value={labaKotor}
              className={`text-xl font-semibold ${labaKotor >= 0 ? "text-success-foreground" : "text-danger-foreground"}`}
            />
          </div>
        </div>

        <div className="flex items-center justify-between rounded-lg bg-accent px-4 py-3">
          <div className="flex items-center gap-3">
            <Trophy className="size-5 text-accent-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">Menu Terlaris Hari Ini</span>
              <span className="text-xs text-muted-foreground">
                {menuTerlarisNama ? (menuTerlarisQty !== null ? `${menuTerlarisNama} — ${menuTerlarisQty} porsi` : menuTerlarisNama) : "Belum ada penjualan"}
              </span>
            </div>
          </div>
        </div>

        {!sudahTutup && (
          <>
            <Button className="self-start" onClick={() => setOpen(true)}>
              <CalculatorIcon className="size-4" />
              Tutup Kasir Hari Ini
            </Button>
            <AlertDialog open={open} onOpenChange={setOpen}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Tutup kasir hari ini?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ringkasan di atas akan disimpan sebagai data final hari ini dan tidak bisa diubah lagi. Pastikan
                    semua transaksi hari ini sudah diinput.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Batal</AlertDialogCancel>
                  <AlertDialogAction onClick={handleTutupKasir} disabled={loading}>
                    {loading ? "Memproses..." : "Tutup Kasir"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardContent>
    </Card>
  );
}
