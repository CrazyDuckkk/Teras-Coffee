"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Currency } from "@/components/shared/currency";
import type { listStokBahan } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listStokBahan>>[number];

export function StockMasukDialog({
  open,
  onOpenChange,
  bahanBaku,
  isOwner,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bahanBaku: BahanBaku[];
  isOwner: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [bahanBakuId, setBahanBakuId] = useState<string>("");
  const [qty, setQty] = useState("");
  const [totalHargaBeli, setTotalHargaBeli] = useState("");
  const [dibayarDari, setDibayarDari] = useState<"kas_laci" | "di_luar_laci">("kas_laci");

  function resetForm() {
    setBahanBakuId("");
    setQty("");
    setTotalHargaBeli("");
    setDibayarDari("kas_laci");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bahanBakuId) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/stock-masuk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bahanBakuId, qty, totalHargaBeli, dibayarDari }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan stock masuk");
        return;
      }
      toast.success("Stock masuk berhasil dicatat");
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const selected = bahanBaku.find((b) => b.id === bahanBakuId);

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  const qtyNum = Number(qty);
  const totalNum = Number(totalHargaBeli);
  const hargaPerSatuanPreview = qtyNum > 0 && totalNum > 0 ? totalNum / qtyNum : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Stock Masuk</DialogTitle>
            <DialogDescription>
              Mencatat pembelian bahan baku — stok bertambah langsung. Harga baru yang dicatat kasir menunggu
              konfirmasi owner.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bahanBakuId">Bahan Baku</Label>
              <Select value={bahanBakuId} onValueChange={(v) => setBahanBakuId(v ?? "")}>
                <SelectTrigger id="bahanBakuId" className="w-full">
                  <SelectValue placeholder="Pilih bahan baku">
                    {(value: string | null) => {
                      const b = bahanBaku.find((item) => item.id === value);
                      return b ? `${b.nama} (${b.satuan})` : "Pilih bahan baku";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bahanBaku.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.nama} ({b.satuan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="qty">Qty {selected ? `(${selected.satuan})` : ""}</Label>
                <Input id="qty" type="number" min="0" step="0.01" required value={qty} onChange={(e) => setQty(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="totalHargaBeli">Total Harga Beli</Label>
                <Input
                  id="totalHargaBeli"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={totalHargaBeli}
                  onChange={(e) => setTotalHargaBeli(e.target.value)}
                  placeholder="Total uang yang dibayar"
                />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="dibayarDari">Dibayar dari</Label>
              <Select
                value={dibayarDari}
                onValueChange={(value) => {
                  if (value === "kas_laci" || value === "di_luar_laci") setDibayarDari(value);
                }}
              >
                <SelectTrigger id="dibayarDari" className="w-full">
                  <SelectValue>
                    {(value: string | null) => value === "kas_laci" ? "Kas laci" : "Di luar laci"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kas_laci">Kas laci</SelectItem>
                  <SelectItem value="di_luar_laci">Di luar laci</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isOwner && hargaPerSatuanPreview !== null && (
              <p className="text-sm text-muted-foreground">
                Harga aktif baru: <Currency value={hargaPerSatuanPreview} className="font-medium text-foreground" /> /{" "}
                {selected?.satuan ?? "satuan"}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
