"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function EditBahanDialog({
  bahan,
  open,
  onOpenChange,
}: {
  bahan: BahanBaku;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* key memaksa remount tiap dialog dibuka — reset form ke nilai bahan yang benar */}
        {open && <EditBahanForm key={bahan.id} bahan={bahan} onOpenChange={onOpenChange} />}
      </DialogContent>
    </Dialog>
  );
}

function EditBahanForm({ bahan, onOpenChange }: { bahan: BahanBaku; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nama, setNama] = useState(bahan.nama);
  const [satuan, setSatuan] = useState<"gram" | "ml" | "pcs">(bahan.satuan);
  const [batasMinimumStok, setBatasMinimumStok] = useState(bahan.batasMinimumStok);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Sengaja hanya kirim field ini — perubahan status aktif/nonaktif punya aksi & endpoint sendiri.
      const res = await fetch(`/api/bahan-baku/${bahan.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, satuan, batasMinimumStok }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal memperbarui bahan baku");
        return;
      }
      toast.success("Bahan baku berhasil diperbarui");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>Edit {bahan.nama}</DialogTitle>
        <DialogDescription>
          Perubahan harga tidak lewat sini — catat lewat Stock Masuk agar riwayat harga tetap tersimpan.
        </DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-nama">Nama Bahan</Label>
          <Input id="edit-nama" required value={nama} onChange={(e) => setNama(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-satuan">Satuan</Label>
            <Select value={satuan} onValueChange={(v) => setSatuan(v as typeof satuan)}>
              <SelectTrigger id="edit-satuan" className="w-full">
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
            <Label htmlFor="edit-batasMinimumStok">Batas Minimum Stok</Label>
            <Input
              id="edit-batasMinimumStok"
              type="number"
              min="0"
              step="any"
              required
              value={batasMinimumStok}
              onChange={(e) => setBatasMinimumStok(e.target.value)}
            />
          </div>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Batal
        </Button>
        <Button type="submit" disabled={loading}>
          {loading ? "Menyimpan..." : "Simpan"}
        </Button>
      </DialogFooter>
    </form>
  );
}
