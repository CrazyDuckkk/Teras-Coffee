"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Ban, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { Currency } from "@/components/shared/currency";
import { formatKategori } from "@/lib/format";
import { cn } from "@/lib/utils";
import { MenuFormDialog } from "./menu-form-dialog";
import { MenuResepDialog } from "./menu-resep-dialog";
import type { listMenu } from "@/lib/queries/menu";
import type { listBahanBaku } from "@/lib/queries/inventaris";
import type { getMenuWithResep } from "@/lib/queries/menu";

type MenuWithHpp = Awaited<ReturnType<typeof listMenu>>[number];
type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function MenuCard({ menu, bahanBaku }: { menu: MenuWithHpp; bahanBaku: BahanBaku[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [resepOpen, setResepOpen] = useState(false);
  const [nonaktifkanOpen, setNonaktifkanOpen] = useState(false);
  const [detail, setDetail] = useState<NonNullable<Awaited<ReturnType<typeof getMenuWithResep>>> | undefined>(undefined);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDeactivate, setLoadingDeactivate] = useState(false);
  const [loadingReactivate, setLoadingReactivate] = useState(false);

  async function loadDetail() {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/menu/${menu.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetail(json.data);
        return true;
      }
      toast.error(json.error ?? "Gagal memuat detail menu");
      return false;
    } finally {
      setLoadingDetail(false);
    }
  }

  async function openEdit() {
    if (await loadDetail()) setEditOpen(true);
  }

  function openResep() {
    setResepOpen(true);
    if (!detail) void loadDetail();
  }

  async function handleNonaktifkan() {
    setLoadingDeactivate(true);
    try {
      const res = await fetch(`/api/menu/${menu.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menonaktifkan menu");
        return;
      }
      toast.success("Menu dinonaktifkan");
      setNonaktifkanOpen(false);
      router.refresh();
    } finally {
      setLoadingDeactivate(false);
    }
  }

  async function handleAktifkanKembali() {
    setLoadingReactivate(true);
    try {
      const res = await fetch(`/api/menu/${menu.id}/aktifkan`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal mengaktifkan kembali menu");
        return;
      }
      toast.success(`${menu.nama} diaktifkan kembali`);
      router.refresh();
    } finally {
      setLoadingReactivate(false);
    }
  }

  return (
    <Card className="gap-3 rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)] transition-shadow hover:shadow-md">
      {/* Wrapper terpisah (bukan onClick di Card) supaya Dialog/AlertDialog di bawah — walau
          dirender via portal — tidak ikut membuka popup resep saat diklik (React synthetic
          event bubbling ikut JSX tree, bukan DOM tree, jadi keduanya harus di luar wrapper ini). */}
      <div
        role="button"
        tabIndex={0}
        onClick={openResep}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openResep();
          }
        }}
        className="flex cursor-pointer flex-col gap-3"
      >
        <CardHeader className="flex flex-row items-start justify-between gap-2">
          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary" className="w-fit">
                {formatKategori(menu.kategori)}
              </Badge>
              {!menu.isActive && (
                <Badge variant="outline" className="w-fit">
                  Nonaktif
                </Badge>
              )}
            </div>
            <h3 className="font-medium leading-tight">{menu.nama}</h3>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Aksi" />}>
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={openEdit} disabled={loadingDetail}>
                  <Pencil className="size-4" />
                  Edit
                </DropdownMenuItem>
                {menu.isActive ? (
                  <DropdownMenuItem variant="destructive" onClick={() => setNonaktifkanOpen(true)}>
                    <Ban className="size-4" />
                    Nonaktifkan
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={handleAktifkanKembali} disabled={loadingReactivate}>
                    <RotateCcw className="size-4" />
                    Aktifkan Kembali
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Harga Jual</span>
            <Currency value={menu.hargaJual} className="text-base font-semibold" />
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Makan di tempat</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">HPP</span>
              <Currency value={menu.hppMakanDiTempat} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Margin</span>
              <Currency
                value={menu.untungMakanDiTempat}
                className={cn(
                  "font-semibold",
                  menu.untungMakanDiTempat >= 0 ? "text-success-foreground" : "text-danger-foreground"
                )}
              />
            </div>
          </div>
          <div className="rounded-lg bg-muted/40 p-2.5">
            <p className="mb-1.5 text-xs font-medium text-muted-foreground">Bawa pulang</p>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">HPP</span>
              <Currency value={menu.hppBawaPulang} />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Margin</span>
              <Currency
                value={menu.untungBawaPulang}
                className={cn(
                  "font-semibold",
                  menu.untungBawaPulang >= 0 ? "text-success-foreground" : "text-danger-foreground"
                )}
              />
            </div>
          </div>
        </CardContent>
      </div>

      <MenuResepDialog menu={menu} detail={detail} open={resepOpen} onOpenChange={setResepOpen} />

      {detail && (
        <MenuFormDialog mode="edit" menu={detail} bahanBaku={bahanBaku} open={editOpen} onOpenChange={setEditOpen} />
      )}

      <AlertDialog open={nonaktifkanOpen} onOpenChange={setNonaktifkanOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nonaktifkan {menu.nama}?</AlertDialogTitle>
            <AlertDialogDescription>
              Menu yang dinonaktifkan tidak akan muncul lagi di grid Transaksi. Riwayat transaksi lama tidak
              terpengaruh.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleNonaktifkan} disabled={loadingDeactivate}>
              {loadingDeactivate ? "Memproses..." : "Nonaktifkan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
