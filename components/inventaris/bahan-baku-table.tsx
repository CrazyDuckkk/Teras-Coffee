"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, History, Ban, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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
import { EditBahanDialog } from "./edit-bahan-dialog";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function BahanBakuTable({ data }: { data: BahanBaku[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"aktif" | "nonaktif">("aktif");
  const [riwayatFor, setRiwayatFor] = useState<BahanBaku | null>(null);
  const [editTarget, setEditTarget] = useState<BahanBaku | null>(null);
  const [nonaktifkanTarget, setNonaktifkanTarget] = useState<BahanBaku | null>(null);
  const [aktivasiLoadingId, setAktivasiLoadingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const jumlahNonaktif = useMemo(() => data.filter((row) => !row.isActive).length, [data]);
  const filtered = useMemo(() => data.filter((row) => (tab === "aktif" ? row.isActive : !row.isActive)), [data, tab]);

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

  async function handleAktifkanKembali(row: BahanBaku) {
    setAktivasiLoadingId(row.id);
    try {
      const res = await fetch(`/api/bahan-baku/${row.id}/aktifkan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal mengaktifkan kembali bahan baku");
        return;
      }
      toast.success(`${row.nama} diaktifkan kembali`);
      router.refresh();
    } finally {
      setAktivasiLoadingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={tab} onValueChange={(v) => setTab((v as typeof tab) ?? "aktif")}>
        <TabsList>
          <TabsTrigger value="aktif">Aktif</TabsTrigger>
          <TabsTrigger value="nonaktif">Nonaktif ({jumlahNonaktif})</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          {tab === "aktif"
            ? 'Belum ada bahan baku. Klik "Bahan Baru" untuk menambahkan.'
            : "Tidak ada bahan baku yang nonaktif."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-card shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
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
              {filtered.map((row) => {
                const { status, label } = stokStatus(Number(row.stokSaatIni), Number(row.batasMinimumStok));
                return (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.nama}</TableCell>
                    <TableCell>{row.satuan}</TableCell>
                    <TableCell className="font-stat tabular-nums">{Number(row.stokSaatIni).toLocaleString("id-ID")}</TableCell>
                    <TableCell>{row.hargaAktif ? <Currency value={row.hargaAktif} /> : "-"}</TableCell>
                    <TableCell>
                      {row.isActive ? (
                        <StatusBadge status={status}>{label}</StatusBadge>
                      ) : (
                        <Badge variant="secondary">Nonaktif</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Aksi" />}>
                          <MoreHorizontal className="size-4" />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setEditTarget(row)}>
                            <Pencil className="size-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setRiwayatFor(row)}>
                            <History className="size-4" />
                            Riwayat Harga
                          </DropdownMenuItem>
                          {row.isActive ? (
                            <DropdownMenuItem variant="destructive" onClick={() => setNonaktifkanTarget(row)}>
                              <Ban className="size-4" />
                              Nonaktifkan
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              disabled={aktivasiLoadingId === row.id}
                              onClick={() => handleAktifkanKembali(row)}
                            >
                              <RotateCcw className="size-4" />
                              Aktifkan Kembali
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <RiwayatHargaSheet
        bahanBakuId={riwayatFor?.id ?? null}
        bahanNama={riwayatFor?.nama ?? null}
        open={riwayatFor !== null}
        onOpenChange={(open) => !open && setRiwayatFor(null)}
      />

      {editTarget && (
        <EditBahanDialog
          bahan={editTarget}
          open={editTarget !== null}
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}

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
