"use client";

import { useState } from "react";
import { Plus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TambahBahanDialog } from "./tambah-bahan-dialog";
import { StockMasukDialog } from "./stock-masuk-dialog";
import type { listStokBahan } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listStokBahan>>[number];

export function InventarisActions({ bahanBaku, isOwner = true }: { bahanBaku: BahanBaku[]; isOwner?: boolean }) {
  const [tambahOpen, setTambahOpen] = useState(false);
  const [stockMasukOpen, setStockMasukOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setStockMasukOpen(true)}>
        <PackagePlus className="size-4" />
        Stock Masuk
      </Button>
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
    </div>
  );
}
