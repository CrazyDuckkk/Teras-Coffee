"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { getHutangDetail } from "@/lib/queries/hutang";

type HutangDetail = NonNullable<Awaited<ReturnType<typeof getHutangDetail>>>;

export function HutangDetailDialog({
  detail,
  open,
  onOpenChange,
}: {
  detail: HutangDetail | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{detail?.namaPelanggan || "Hutang tanpa nama"}</DialogTitle>
          <DialogDescription>
            {detail ? formatTanggalWaktuWIB(new Date(detail.tanggalHutang)) : "Memuat detail..."}
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">Status</span>
              {detail.status === "lunas" ? (
                <Badge className="bg-success text-success-foreground">
                  Lunas — {detail.tanggalLunas ? formatTanggalWaktuWIB(new Date(detail.tanggalLunas)) : ""}
                </Badge>
              ) : (
                <Badge className="bg-warning text-warning-foreground">Belum Lunas</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Item Terjual</span>
              <div className="flex flex-col gap-1">
                {detail.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>
                      {item.menuNama} x{item.qty}
                      {item.bawaPulang && <span className="text-muted-foreground"> · Bawa pulang</span>}
                    </span>
                    <Currency value={Number(item.hargaJualSaatItu) * item.qty} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-border pt-3 font-medium">
              <span>Total Hutang</span>
              <Currency value={detail.jumlah} className="text-lg" />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
