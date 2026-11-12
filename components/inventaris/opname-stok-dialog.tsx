"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { tampilkanPeringatanEkspor } from "@/components/keuangan/export-warning";
import type { listStokBahan } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listStokBahan>>[number];

export function OpnameStokDialog({
  open,
  onOpenChange,
  bahanBaku,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bahanBaku: BahanBaku[];
}) {
  const router = useRouter();
  const [bahanBakuId, setBahanBakuId] = useState("");
  const [stokFisik, setStokFisik] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const selected = bahanBaku.find((item) => item.id === bahanBakuId);

  function resetForm() {
    setBahanBakuId("");
    setStokFisik("");
    setAlasan("");
  }

  function closeDialog() {
    if (loading) return;
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) {
      toast.error("Pilih bahan baku terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/opname", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bahanBakuId, stokFisik, alasan }),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal mencatat hasil opname");
        return;
      }

      toast.success("Hasil opname berhasil dicatat");
      tampilkanPeringatanEkspor(result.peringatanEkspor);
      resetForm();
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Opname Stok</DialogTitle>
            <DialogDescription>
              Masukkan hitungan fisik. Stok sistem akan disesuaikan; jika stok berkurang, nilainya dicatat sebagai susut.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="bahan-opname">Bahan baku</Label>
              <Select value={bahanBakuId} onValueChange={(value) => setBahanBakuId(value ?? "")}>
                <SelectTrigger id="bahan-opname" className="w-full">
                  <SelectValue placeholder="Pilih bahan baku">
                    {(value: string | null) => {
                      const item = bahanBaku.find((bahan) => bahan.id === value);
                      return item ? `${item.nama} (${item.satuan})` : "Pilih bahan baku";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {bahanBaku.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nama} ({item.satuan})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selected && (
              <p className="text-sm text-muted-foreground">
                Stok sistem saat ini:{" "}
                <span className="font-medium text-foreground">
                  {Number(selected.stokSaatIni).toLocaleString("id-ID")} {selected.satuan}
                </span>
              </p>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="stok-fisik">Hitungan fisik {selected ? `(${selected.satuan})` : ""}</Label>
              <Input
                id="stok-fisik"
                type="number"
                min="0"
                step="0.01"
                required
                value={stokFisik}
                onChange={(event) => setStokFisik(event.target.value)}
                placeholder="Jumlah yang benar-benar tersedia"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="alasan-opname">Alasan</Label>
              <Input
                id="alasan-opname"
                required
                minLength={3}
                maxLength={500}
                value={alasan}
                onChange={(event) => setAlasan(event.target.value)}
                placeholder="Contoh: stok dihitung saat pergantian shift"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button type="submit" disabled={loading || !selected}>
              {loading ? "Menyimpan..." : "Simpan hasil opname"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
