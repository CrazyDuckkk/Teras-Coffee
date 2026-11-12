"use client";

import { useState } from "react";
import { ClipboardCheck, ClipboardList, Plus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TambahBahanDialog } from "./tambah-bahan-dialog";
import { StockMasukDialog } from "./stock-masuk-dialog";
import { OpnameStokDialog } from "./opname-stok-dialog";
import { PenyesuaianStokDialog } from "./penyesuaian-stok-dialog";
import type { listMenuUntukPenyesuaian, listStokBahan } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listStokBahan>>[number];
type MenuAktif = Awaited<ReturnType<typeof listMenuUntukPenyesuaian>>[number];

export function InventarisActions({
  bahanBaku,
  menuAktif,
  isOwner = true,
}: {
  bahanBaku: BahanBaku[];
  menuAktif: MenuAktif[];
  isOwner?: boolean;
}) {
  const [tambahOpen, setTambahOpen] = useState(false);
  const [stockMasukOpen, setStockMasukOpen] = useState(false);
  const [penyesuaianOpen, setPenyesuaianOpen] = useState(false);
  const [opnameOpen, setOpnameOpen] = useState(false);

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setStockMasukOpen(true)}>
        <PackagePlus className="size-4" />
        Stock Masuk
      </Button>
      <Button variant="outline" onClick={() => setPenyesuaianOpen(true)}>
        <ClipboardList className="size-4" />
        Catat Penyesuaian
      </Button>
      {isOwner && (
        <Button variant="outline" onClick={() => setOpnameOpen(true)}>
          <ClipboardCheck className="size-4" />
          Opname
        </Button>
      )}
      {isOwner && (
        <Button onClick={() => setTambahOpen(true)}>
          <Plus className="size-4" />
          Bahan Baru
        </Button>
      )}
      {isOwner && <TambahBahanDialog open={tambahOpen} onOpenChange={setTambahOpen} />}
      <StockMasukDialog
        open={stockMasukOpen}
        onOpenChange={setStockMasukOpen}
        bahanBaku={bahanBaku}
        isOwner={isOwner}
      />
      <PenyesuaianStokDialog
        open={penyesuaianOpen}
        onOpenChange={setPenyesuaianOpen}
        bahanBaku={bahanBaku}
        menuAktif={menuAktif}
      />
      {isOwner && <OpnameStokDialog open={opnameOpen} onOpenChange={setOpnameOpen} bahanBaku={bahanBaku} />}
    </div>
  );
}
