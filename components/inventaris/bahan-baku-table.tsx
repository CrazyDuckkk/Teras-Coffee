"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, History, Ban } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { StatusBadge, stokStatus } from "@/components/shared/status-badge";
import { Currency } from "@/components/shared/currency";
import { RiwayatHargaSheet } from "./riwayat-harga-sheet";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function BahanBakuTable({ data }: { data: BahanBaku[] }) {
  const router = useRouter();
  const [riwayatFor, setRiwayatFor] = useState<BahanBaku | null>(null);
  const [nonaktifkanTarget, setNonaktifkanTarget] = useState<BahanBaku | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleNonaktifkan() {
    if (!nonaktifkanTarget) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/bahan-baku/${nonaktifkanTarget.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menonaktifkan bahan baku");
        return;
      }
      toast.success("Bahan baku dinonaktifkan");
      setNonaktifkanTarget(null);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada bahan baku. Klik &quot;Bahan Baru&quot; untuk menambahkan.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[#E2E8F0] bg-card shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Satuan</TableHead>
            <TableHead>Stok Saat Ini</TableHead>
            <TableHead>Harga Aktif</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => {
            const { status, label } = stokStatus(Number(row.stokSaatIni), Number(row.batasMinimumStok));
            return (
              <TableRow key={row.id}>
                <TableCell className="font-medium">{row.nama}</TableCell>
                <TableCell>{row.satuan}</TableCell>
                <TableCell className="font-stat tabular-nums">{Number(row.stokSaatIni).toLocaleString("id-ID")}</TableCell>
                <TableCell>{row.hargaAktif ? <Currency value={row.hargaAktif} /> : "-"}</TableCell>
                <TableCell>
                  <StatusBadge status={status}>{label}</StatusBadge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Aksi" />}>
                      <MoreHorizontal className="size-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setRiwayatFor(row)}>
                        <History className="size-4" />
                        Riwayat Harga
                      </DropdownMenuItem>
                      <DropdownMenuItem variant="destructive" onClick={() => setNonaktifkanTarget(row)}>
                        <Ban className="size-4" />
                        Nonaktifkan
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      <RiwayatHargaSheet
        bahanBakuId={riwayatFor?.id ?? null}
        bahanNama={riwayatFor?.nama ?? null}
        open={riwayatFor !== null}
        onOpenChange={(open) => !open && setRiwayatFor(null)}
      />

      <AlertDialog open={nonaktifkanTarget !== null} onOpenChange={(open) => !open && setNonaktifkanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan {nonaktifkanTarget?.nama}?</AlertDialogTitle>
            <AlertDialogDescription>
              Bahan yang dinonaktifkan tidak akan muncul lagi di pilihan resep menu baru. Jika masih dipakai resep
              menu yang aktif, aksi ini akan ditolak.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleNonaktifkan} disabled={loading}>
              {loading ? "Memproses..." : "Nonaktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
