"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Ban } from "lucide-react";
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
import type { listMenu } from "@/lib/queries/menu";
import type { listBahanBaku } from "@/lib/queries/inventaris";
import type { getMenuWithResep } from "@/lib/queries/menu";

type MenuWithHpp = Awaited<ReturnType<typeof listMenu>>[number];
type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function MenuCard({ menu, bahanBaku }: { menu: MenuWithHpp; bahanBaku: BahanBaku[] }) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [nonaktifkanOpen, setNonaktifkanOpen] = useState(false);
  const [detail, setDetail] = useState<NonNullable<Awaited<ReturnType<typeof getMenuWithResep>>> | undefined>(undefined);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [loadingDeactivate, setLoadingDeactivate] = useState(false);

  async function openEdit() {
    setLoadingDetail(true);
    try {
      const res = await fetch(`/api/menu/${menu.id}`);
      const json = await res.json();
      if (res.ok) {
        setDetail(json.data);
        setEditOpen(true);
      } else {
        toast.error(json.error ?? "Gagal memuat detail menu");
      }
    } finally {
      setLoadingDetail(false);
    }
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

  const untung = menu.untung;

  return (
    <Card className="gap-3 rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div className="flex flex-col gap-1.5">
          <Badge variant="secondary" className="w-fit">
            {formatKategori(menu.kategori)}
          </Badge>
          <h3 className="font-medium leading-tight">{menu.nama}</h3>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="ghost" size="icon" aria-label="Aksi" />}>
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={openEdit} disabled={loadingDetail}>
              <Pencil className="size-4" />
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setNonaktifkanOpen(true)}>
              <Ban className="size-4" />
              Nonaktifkan
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Harga Jual</span>
          <Currency value={menu.hargaJual} className="text-base font-semibold" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">HPP</span>
          <Currency value={menu.hpp} className="text-base" />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Untung</span>
          <Currency
            value={untung}
            className={cn("text-base font-semibold", untung >= 0 ? "text-success-foreground" : "text-danger-foreground")}
          />
        </div>
      </CardContent>

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
