"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Currency } from "@/components/shared/currency";
import { formatKategori, sortKategoriList } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getRequiredIngredients } from "@/lib/transaction-recipes";
import type { getKasirData } from "@/lib/queries/transaksi";

type KasirData = Awaited<ReturnType<typeof getKasirData>>;
type MenuRow = KasirData["menus"][number];
type CartLine = { qty: number; bawaPulang: boolean };
type CartItem = { menu: MenuRow; qty: number; bawaPulang: boolean };

export function Kasir({ menus, resep, bahan }: KasirData) {
  const router = useRouter();
  const [cart, setCart] = useState<Record<string, CartLine>>({});
  const [submitting, setSubmitting] = useState(false);
  const [metodeBayar, setMetodeBayar] = useState<"tunai" | "qris" | "hutang">("tunai");
  const [namaPelanggan, setNamaPelanggan] = useState("");

  const kategoriList = useMemo(() => sortKategoriList(menus.map((m) => m.kategori)), [menus]);
  const [activeKategori, setActiveKategori] = useState("semua");

  const bahanMap = useMemo(() => new Map(bahan.map((b) => [b.id, b])), [bahan]);

  function getCurrentItems(currentCart = cart) {
    return Object.entries(currentCart).map(([menuId, line]) => ({
      menuId,
      qty: line.qty,
      bawaPulang: line.bawaPulang,
    }));
  }

  function getShortages(items: { menuId: string; qty: number; bawaPulang: boolean }[]) {
    return getRequiredIngredients(items, resep).flatMap(({ bahanBakuId, qtyDipakai }) => {
      const ingredient = bahanMap.get(bahanBakuId);
      const available = ingredient ? Number(ingredient.stokSaatIni) : 0;
      return qtyDipakai > available
        ? [{ nama: ingredient?.nama ?? "Bahan", butuh: qtyDipakai, tersedia: available }]
        : [];
    });
  }

  /** Berapa qty tambahan menu ini yang masih bisa ditambahkan tanpa melebihi stok bahan (akumulasi lintas cart). */
  function getMaxAddableQty(menuId: string, bawaPulang = cart[menuId]?.bawaPulang ?? false): number {
    const requiredForOne = getRequiredIngredients([{ menuId, qty: 1, bawaPulang }], resep);
    if (requiredForOne.length === 0) return Infinity;

    let max = Infinity;
    const usedByBahan = new Map(
      getRequiredIngredients(getCurrentItems(), resep).map((item) => [item.bahanBakuId, item.qtyDipakai])
    );
    for (const requirement of requiredForOne) {
      const ingredient = bahanMap.get(requirement.bahanBakuId);
      const stock = ingredient ? Number(ingredient.stokSaatIni) : 0;
      const used = usedByBahan.get(requirement.bahanBakuId) ?? 0;
      const maxForBahan =
        requirement.qtyDipakai > 0
          ? Math.floor((stock - used) / requirement.qtyDipakai)
          : Infinity;
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
    setCart((prev) => ({
      ...prev,
      [menuId]: {
        qty: (prev[menuId]?.qty ?? 0) + amount,
        bawaPulang: prev[menuId]?.bawaPulang ?? false,
      },
    }));
  }

  function decreaseQty(menuId: string) {
    setCart((prev) => {
      const next = { ...prev };
      const current = next[menuId]?.qty ?? 0;
      if (current <= 1) {
        delete next[menuId];
      } else {
        next[menuId] = { ...next[menuId], qty: current - 1 };
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

  function setItemTakeaway(menuId: string, bawaPulang: boolean) {
    const currentLine = cart[menuId];
    if (!currentLine) return;
    const proposedCart = {
      ...cart,
      [menuId]: { ...currentLine, bawaPulang },
    };
    const shortages = getShortages(getCurrentItems(proposedCart));
    if (shortages.length > 0) {
      toast.warning(`Stok ${shortages[0].nama} tidak cukup untuk pilihan bawa pulang`);
      return;
    }
    setCart(proposedCart);
  }

  function setAllTakeaway(bawaPulang: boolean) {
    const proposedCart = Object.fromEntries(
      Object.entries(cart).map(([menuId, line]) => [menuId, { ...line, bawaPulang }])
    );
    const shortages = getShortages(getCurrentItems(proposedCart));
    if (shortages.length > 0) {
      toast.warning(`Stok ${shortages[0].nama} tidak cukup untuk semua item bawa pulang`);
      return;
    }
    setCart(proposedCart);
  }

  const cartItems = Object.entries(cart)
    .map(([menuId, line]) => {
      const m = menus.find((menu) => menu.id === menuId);
      return m ? { menu: m, qty: line.qty, bawaPulang: line.bawaPulang } : null;
    })
    .filter((x): x is CartItem => x !== null);

  const semuaBawaPulang = cartItems.length > 0 && cartItems.every((item) => item.bawaPulang);

  const total = cartItems.reduce((sum, item) => sum + Number(item.menu.hargaJual) * item.qty, 0);

  const filteredMenus = activeKategori === "semua" ? menus : menus.filter((m) => m.kategori === activeKategori);

  async function handleSimpan() {
    if (cartItems.length === 0) return;
    if (metodeBayar === "hutang" && !namaPelanggan.trim()) {
      toast.error("Nama pelanggan wajib diisi untuk transaksi hutang");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/transaksi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cartItems.map((i) => ({ menuId: i.menu.id, qty: i.qty, bawaPulang: i.bawaPulang })),
          metodeBayar,
          namaPelanggan: metodeBayar === "hutang" && namaPelanggan.trim() ? namaPelanggan.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan transaksi");
        return;
      }
      toast.success(
        metodeBayar === "hutang" ? "Transaksi hutang berhasil disimpan" : "Transaksi berhasil disimpan"
      );
      setCart({});
      setMetodeBayar("tunai");
      setNamaPelanggan("");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
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
              const qty = cart[m.id]?.qty ?? 0;
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
          {cartItems.length > 0 && (
            <Button
              type="button"
              size="sm"
              variant={semuaBawaPulang ? "default" : "outline"}
              aria-pressed={semuaBawaPulang}
              onClick={() => setAllTakeaway(!semuaBawaPulang)}
            >
              {semuaBawaPulang ? "Semua bawa pulang" : "Jadikan semua bawa pulang"}
            </Button>
          )}
          <Separator />
          {cartItems.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Belum ada item dipilih.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {cartItems.map((item) => (
                <div key={item.menu.id} className="flex flex-col gap-2 text-sm">
                  <div className="flex items-center justify-between gap-2">
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
                  <div className="grid grid-cols-2 gap-1">
                    <Button
                      type="button"
                      size="sm"
                      variant={!item.bawaPulang ? "secondary" : "outline"}
                      aria-pressed={!item.bawaPulang}
                      onClick={() => setItemTakeaway(item.menu.id, false)}
                    >
                      Makan di tempat
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant={item.bawaPulang ? "secondary" : "outline"}
                      aria-pressed={item.bawaPulang}
                      onClick={() => setItemTakeaway(item.menu.id, true)}
                    >
                      Bawa pulang
                    </Button>
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
          <div className="flex flex-col gap-2">
            <Label>Metode Bayar</Label>
            <Tabs
              value={metodeBayar}
              onValueChange={(value) => {
                if (value === "tunai" || value === "qris" || value === "hutang") setMetodeBayar(value);
              }}
            >
              <TabsList className="w-full">
                <TabsTrigger value="tunai" className="flex-1">
                  Tunai
                </TabsTrigger>
                <TabsTrigger value="qris" className="flex-1">
                  QRIS
                </TabsTrigger>
                <TabsTrigger value="hutang" className="flex-1">
                  Hutang
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          {metodeBayar === "hutang" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="namaPelanggan">Nama Pelanggan</Label>
              <Input
                id="namaPelanggan"
                value={namaPelanggan}
                onChange={(e) => setNamaPelanggan(e.target.value)}
                placeholder="Mis. Budi"
                required
              />
            </div>
          )}
          <Button
            disabled={
              cartItems.length === 0 ||
              submitting ||
              (metodeBayar === "hutang" && !namaPelanggan.trim())
            }
            onClick={handleSimpan}
          >
            {submitting
              ? "Menyimpan..."
              : metodeBayar === "hutang"
                ? "Simpan Transaksi (Hutang)"
                : metodeBayar === "qris"
                  ? "Simpan Transaksi (QRIS)"
                  : "Simpan Transaksi"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
