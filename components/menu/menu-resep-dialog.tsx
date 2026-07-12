"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Currency } from "@/components/shared/currency";
import { formatKategori } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { listMenu, getMenuWithResep } from "@/lib/queries/menu";

type MenuWithHpp = Awaited<ReturnType<typeof listMenu>>[number];
type MenuDetail = NonNullable<Awaited<ReturnType<typeof getMenuWithResep>>>;

export function MenuResepDialog({
  menu,
  detail,
  open,
  onOpenChange,
}: {
  menu: MenuWithHpp;
  detail: MenuDetail | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const hpp = menu.hpp;
  const untung = menu.untung;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <Badge variant="secondary" className="w-fit">
            {formatKategori(menu.kategori)}
          </Badge>
          <DialogTitle>{menu.nama}</DialogTitle>
          <DialogDescription>Resep dan breakdown kontribusi HPP per bahan.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Harga Jual</span>
              <Currency value={menu.hargaJual} className="font-semibold" />
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">HPP</span>
              <Currency value={hpp} />
            </div>
            <Separator />
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Untung</span>
              <Currency
                value={untung}
                className={cn("font-semibold", untung >= 0 ? "text-success-foreground" : "text-danger-foreground")}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Resep ({detail?.resep.length ?? 0} bahan)</span>
            {!detail ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Memuat resep...</p>
            ) : detail.resep.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Menu ini belum punya resep.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {detail.resep.map((r) => {
                  const subtotal = Number(r.takaran) * Number(r.hargaPerSatuan ?? 0);
                  const persen = hpp > 0 ? (subtotal / hpp) * 100 : 0;
                  return (
                    <div key={r.id} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.bahanNama}</span>
                        <Currency value={subtotal} className="font-medium" />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {Number(r.takaran).toLocaleString("id-ID")} {r.satuan}
                          {r.hargaPerSatuan ? (
                            <>
                              {" "}
                              &times; <Currency value={r.hargaPerSatuan} />/{r.satuan}
                            </>
                          ) : (
                            " (belum ada riwayat harga)"
                          )}
                        </span>
                        <span>{persen.toFixed(0)}% dari HPP</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
