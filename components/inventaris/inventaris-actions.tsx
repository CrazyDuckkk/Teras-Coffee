"use client";

import { useState } from "react";
import { Plus, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TambahBahanDialog } from "./tambah-bahan-dialog";
import { StockMasukDialog } from "./stock-masuk-dialog";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function InventarisActions({ bahanBaku }: { bahanBaku: BahanBaku[] }) {
  const [tambahOpen, setTambahOpen] = useState(false);
  const [stockMasukOpen, setStockMasukOpen] = useState(false);

  return (
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => setStockMasukOpen(true)}>
        <PackagePlus className="size-4" />
        Stock Masuk
      </Button>
      <Button onClick={() => setTambahOpen(true)}>
        <Plus className="size-4" />
        Bahan Baru
      </Button>
      <TambahBahanDialog open={tambahOpen} onOpenChange={setTambahOpen} />
      <StockMasukDialog open={stockMasukOpen} onOpenChange={setStockMasukOpen} bahanBaku={bahanBaku} />
    </div>
  );
}
