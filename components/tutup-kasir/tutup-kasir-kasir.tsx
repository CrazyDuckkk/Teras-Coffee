"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalculatorIcon, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Currency } from "@/components/shared/currency";
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

export function TutupKasirKasir({
  totalPenjualan,
  sudahTutup,
}: {
  totalPenjualan: number;
  sudahTutup: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function handleTutupKasir() {
    setLoading(true);
    try {
      const response = await fetch("/api/tutup-kasir", { method: "POST" });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal menutup kasir");
        return;
      }

      toast.success("Kasir hari ini berhasil ditutup");
      setConfirmOpen(false);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Tutup Kasir</CardTitle>
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
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">
            Pemasukan tunai dan pelunasan hutang hari ini
          </span>
          <Currency value={totalPenjualan} className="text-xl font-semibold" />
        </div>
        {!sudahTutup && (
          <Button
            className="self-start"
            disabled={loading}
            onClick={() => setConfirmOpen(true)}
          >
            <CalculatorIcon className="size-4" />
            Tutup Kasir Hari Ini
          </Button>
        )}
        <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Tutup kasir hari ini?</AlertDialogTitle>
              <AlertDialogDescription>
                Pastikan semua transaksi sudah dicatat. Ringkasan penutupan akan disimpan dan tidak dapat diubah.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={loading}>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleTutupKasir} disabled={loading}>
                {loading ? "Memproses..." : "Tutup Kasir"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
