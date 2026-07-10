"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Currency } from "@/components/shared/currency";
import { formatKategori } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { getKasirData } from "@/lib/queries/transaksi";

type KasirData = Awaited<ReturnType<typeof getKasirData>>;
type MenuRow = KasirData["menus"][number];

export function Kasir({ menus, resep, bahan }: KasirData) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);

  const kategoriList = useMemo(() => Array.from(new Set(menus.map((m) => m.kategori))).sort(), [menus]);
  const [activeKategori, setActiveKategori] = useState("semua");

  const resepByMenu = useMemo(() => {
    const map = new Map<string, typeof resep>();
    for (const r of resep) {
      const list = map.get(r.menuId) ?? [];
      list.push(r);
      map.set(r.menuId, list);
    }
    return map;
  }, [resep]);

  const bahanMap = useMemo(() => new Map(bahan.map((b) => [b.id, b])), [bahan]);

  /** Berapa qty tambahan menu ini yang masih bisa ditambahkan tanpa melebihi stok bahan (akumulasi lintas cart). */
  function getMaxAddableQty(menuId: string): number {
    const resepMenu = resepByMenu.get(menuId) ?? [];
    if (resepMenu.length === 0) return Infinity;

    let max = Infinity;
    for (const r of resepMenu) {
      const b = bahanMap.get(r.bahanBakuId);
      const stok = b ? Number(b.stokSaatIni) : 0;

      let used = 0;
      for (const [mId, qty] of Object.entries(cart)) {
        for (const rr of resepByMenu.get(mId) ?? []) {
          if (rr.bahanBakuId === r.bahanBakuId) used += Number(rr.takaran) * qty;
        }
      }

      const takaran = Number(r.takaran);
      const maxForBahan = takaran > 0 ? Math.floor((stok - used) / takaran) : Infinity;
      max = Math.min(max, maxForBahan);
    }
    return Math.max(0, max);
  }

  function addQty(menuId: string, amount: number) {
    const maxAddable = getMaxAddableQty(menuId);
    if (maxAddable < amount) {
      toast.warning(amount === 1 ? "Stok bahan tidak cukup" : `Stok bahan hanya cukup untuk tambahan ${maxAddable}`);
      if (maxAddable <= 0) return;
      amount = maxAddable;
    }
    setCart((prev) => ({ ...prev, [menuId]: (prev[menuId] ?? 0) + amount }));
  }

  function decreaseQty(menuId: string) {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[menuId] ?? 0;
      if (current <= 1) {
        delete next[menuId];
      } else {
        next[menuId] = current - 1;
      }
      return next;
    });
  }

  function removeItem(menuId: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[menuId];
      return next;
    });
  }

  const cartItems = Object.entries(cart)
    .map(([menuId, qty]) => {
      const m = menus.find((menu) => menu.id === menuId);
      return m ? { menu: m, qty } : null;
    })
    .filter((x): x is { menu: MenuRow; qty: number } => x !== null);

  const total = cartItems.reduce((sum, item) => sum + Number(item.menu.hargaJual) * item.qty, 0);

  const filteredMenus = activeKategori === "semua" ? menus : menus.filter((m) => m.kategori === activeKategori);

  async function handleSimpan() {
    if (cartItems.length === 0) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: cartItems.map((i) => ({ menuId: i.menu.id, qty: i.qty })) }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan transaksi");
        return;
      }
      toast.success("Transaksi berhasil disimpan");
      setCart({});
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
      <div className="flex flex-col gap-4">
        <Tabs value={activeKategori} onValueChange={(v) => setActiveKategori(v ?? "semua")}>
          <TabsList>
            <TabsTrigger value="semua">Semua</TabsTrigger>
            {kategoriList.map((k) => (
              <TabsTrigger key={k} value={k}>
                {formatKategori(k)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filteredMenus.length === 0 ? (
          <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
            Belum ada menu aktif. Tambahkan menu terlebih dahulu di halaman Menu.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {filteredMenus.map((m) => {
              const qty = cart[m.id] ?? 0;
              const maxAddable = getMaxAddableQty(m.id);
              const habis = maxAddable <= 0 && qty === 0;
              return (
                <Card key={m.id} className={cn("gap-2 rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]", habis && "opacity-50")}>
                  <CardContent className="flex flex-col gap-2 px-3">
                    <span className="text-sm font-medium leading-tight">{m.nama}</span>
                    <Currency value={m.hargaJual} className="text-sm" />
                    {habis && <span className="text-xs text-danger-foreground">Stok habis</span>}
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={maxAddable < 1}
                        onClick={() => addQty(m.id, 1)}
                      >
                        +1
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        disabled={maxAddable < 1}
                        onClick={() => addQty(m.id, 5)}
                      >
                        +5
                      </Button>
                    </div>
                    {qty > 0 && (
                      <div className="flex items-center justify-between rounded-md bg-accent px-2 py-1 text-sm">
                        <button type="button" onClick={() => decreaseQty(m.id)} aria-label="Kurangi qty" className="text-accent-foreground">
                          <Minus className="size-3.5" />
                        </button>
                        <span className="font-stat font-medium tabular-nums">{qty}</span>
                        <button
                          type="button"
                          onClick={() => addQty(m.id, 1)}
                          aria-label="Tambah qty"
                          disabled={maxAddable < 1}
                          className="text-accent-foreground disabled:opacity-40"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <Card className="h-fit rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)] lg:sticky lg:top-6">
        <CardContent className="flex flex-col gap-3">
          <h2 className="font-medium">Ringkasan Pesanan</h2>
          <Separator />
          {cartItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada item dipilih.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {cartItems.map((item) => (
                <div key={item.menu.id} className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex flex-col">
                    <span className="font-medium">{item.menu.nama}</span>
                    <span className="text-xs text-muted-foreground">
                      {item.qty} x <Currency value={item.menu.hargaJual} />
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Currency value={Number(item.menu.hargaJual) * item.qty} className="font-medium" />
                    <button type="button" aria-label="Hapus dari keranjang" onClick={() => removeItem(item.menu.id)}>
                      <Trash2 className="size-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Separator />
          <div className="flex items-center justify-between font-medium">
            <span>Total</span>
            <Currency value={total} className="text-lg" />
          </div>
          <Button disabled={cartItems.length === 0 || submitting} onClick={handleSimpan}>
            {submitting ? "Menyimpan..." : "Simpan Transaksi"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
