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
          <div className="flex flex-col gap-3 rounded-lg border border-border p-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Harga Jual</span>
              <Currency value={menu.hargaJual} className="font-semibold" />
            </div>
            {[
              {
                label: "Makan di tempat",
                hpp: menu.hppMakanDiTempat,
                margin: menu.untungMakanDiTempat,
              },
              {
                label: "Bawa pulang",
                hpp: menu.hppBawaPulang,
                margin: menu.untungBawaPulang,
              },
            ].map((portion) => (
              <div key={portion.label} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{portion.label}</p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">HPP</span>
                  <Currency value={portion.hpp} />
                </div>
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Margin</span>
                  <Currency
                    value={portion.margin}
                    className={cn(
                      "font-semibold",
                      portion.margin >= 0 ? "text-success-foreground" : "text-danger-foreground"
                    )}
                  />
                </div>
                {portion.label === "Makan di tempat" && <Separator />}
              </div>
            ))}
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
                  const dineInSubtotal = r.hanyaBawaPulang ? 0 : subtotal;
                  const dineInPercent =
                    menu.hppMakanDiTempat > 0 ? (dineInSubtotal / menu.hppMakanDiTempat) * 100 : 0;
                  const takeawayPercent = menu.hppBawaPulang > 0 ? (subtotal / menu.hppBawaPulang) * 100 : 0;
                  return (
                    <div key={r.id} className="flex flex-col gap-1 rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{r.bahanNama}</span>
                        <Currency value={subtotal} className="font-medium" />
                      </div>
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs text-muted-foreground">
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
                        <span>{r.hanyaBawaPulang ? "Khusus bawa pulang" : "Selalu dipakai"}</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Makan di tempat: {dineInPercent.toFixed(0)}%</span>
                        <span>Bawa pulang: {takeawayPercent.toFixed(0)}%</span>
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
