"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";

interface RiwayatHargaRow {
  id: string;
  hargaPerSatuan: string;
  berlakuSejak: string;
  dibatalkanAt: string | null;
}

export function RiwayatHargaSheet({
  bahanBakuId,
  bahanNama,
  open,
  onOpenChange,
}: {
  bahanBakuId: string | null;
  bahanNama: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [rows, setRows] = useState<RiwayatHargaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const activeId = rows.find((row) => !row.dibatalkanAt)?.id;

  useEffect(() => {
    if (!open || !bahanBakuId) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      try {
        const res = await fetch(`/api/bahan-baku/${bahanBakuId}/riwayat-harga`);
        const json = await res.json();
        if (!cancelled) setRows(json.data ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, bahanBakuId]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Riwayat Harga</SheetTitle>
          <SheetDescription>{bahanNama ?? ""}</SheetDescription>
        </SheetHeader>
        <div className="flex flex-col gap-3 overflow-y-auto px-4 pb-4">
          {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
          {!loading && rows.length === 0 && <p className="text-sm text-muted-foreground">Belum ada riwayat harga.</p>}
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <div className="flex flex-col">
                <Currency value={row.hargaPerSatuan} className="text-base font-semibold" />
                <span className="text-xs text-muted-foreground">{formatTanggalWaktuWIB(new Date(row.berlakuSejak))}</span>
              </div>
              {row.dibatalkanAt ? (
                <span className="text-xs text-muted-foreground">Dibatalkan</span>
              ) : activeId === row.id ? (
                <span className="text-xs font-medium text-success-foreground">Aktif</span>
              ) : null}
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
