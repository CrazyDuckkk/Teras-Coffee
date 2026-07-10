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

export function TambahBahanDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nama, setNama] = useState("");
  const [satuan, setSatuan] = useState<"gram" | "ml" | "pcs">("gram");
  const [stokAwal, setStokAwal] = useState("");
  const [batasMinimumStok, setBatasMinimumStok] = useState("");
  const [totalHargaBeliAwal, setTotalHargaBeliAwal] = useState("");

  function resetForm() {
    setNama("");
    setSatuan("gram");
    setStokAwal("");
    setBatasMinimumStok("");
    setTotalHargaBeliAwal("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/bahan-baku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, satuan, stokAwal, batasMinimumStok, totalHargaBeliAwal }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal membuat bahan baku");
        return;
      }
      toast.success("Bahan baku berhasil ditambahkan");
      resetForm();
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    if (!next) resetForm();
    onOpenChange(next);
  }

  const stokAwalNum = Number(stokAwal);
  const totalNum = Number(totalHargaBeliAwal);
  const hargaPerSatuanPreview = stokAwalNum > 0 && totalNum > 0 ? totalNum / stokAwalNum : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Bahan Baru</DialogTitle>
            <DialogDescription>Tambahkan bahan baku beserta stok & total harga beli awal.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="nama">Nama Bahan</Label>
              <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Kopi Bubuk Arabika" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="satuan">Satuan</Label>
                <Select value={satuan} onValueChange={(v) => setSatuan(v as typeof satuan)}>
                  <SelectTrigger id="satuan" className="w-full">
                    <SelectValue>{(value: string) => ({ gram: "Gram", ml: "ml", pcs: "pcs" })[value] ?? value}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gram">Gram</SelectItem>
                    <SelectItem value="ml">ml</SelectItem>
                    <SelectItem value="pcs">pcs</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="stokAwal">Stok Awal ({satuan})</Label>
                <Input id="stokAwal" type="number" min="0" step="any" required value={stokAwal} onChange={(e) => setStokAwal(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="batasMinimumStok">Batas Minimum Stok</Label>
                <Input
                  id="batasMinimumStok"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={batasMinimumStok}
                  onChange={(e) => setBatasMinimumStok(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="totalHargaBeliAwal">Total Harga Beli</Label>
                <Input
                  id="totalHargaBeliAwal"
                  type="number"
                  min="0"
                  step="any"
                  required
                  value={totalHargaBeliAwal}
                  onChange={(e) => setTotalHargaBeliAwal(e.target.value)}
                  placeholder="Total uang yang dibayar"
                />
              </div>
            </div>
            {hargaPerSatuanPreview !== null && (
              <p className="text-sm text-muted-foreground">
                Harga per satuan: <Currency value={hargaPerSatuanPreview} className="font-medium text-foreground" /> / {satuan}
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
