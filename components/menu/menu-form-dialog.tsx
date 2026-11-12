"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { listBahanBaku } from "@/lib/queries/inventaris";
import type { getMenuWithResep } from "@/lib/queries/menu";
import { KATEGORI_OPTIONS, formatKategori } from "@/lib/format";

type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];
type MenuWithResep = NonNullable<Awaited<ReturnType<typeof getMenuWithResep>>>;

interface ResepRow {
  bahanBakuId: string;
  takaran: string;
  hanyaBawaPulang: boolean;
}

interface MenuFormDialogProps {
  mode: "create" | "edit";
  menu?: MenuWithResep;
  bahanBaku: BahanBaku[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MenuFormDialog({ mode, menu, bahanBaku, open, onOpenChange }: MenuFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        {/* key memaksa remount tiap dialog dibuka (bukan sync via useEffect) — reset form ke nilai awal yang benar */}
        {open && (
          <MenuForm key={mode === "edit" ? menu?.id : "create"} mode={mode} menu={menu} bahanBaku={bahanBaku} onOpenChange={onOpenChange} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function MenuForm({
  mode,
  menu,
  bahanBaku,
  onOpenChange,
}: {
  mode: "create" | "edit";
  menu?: MenuWithResep;
  bahanBaku: BahanBaku[];
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [nama, setNama] = useState(menu?.nama ?? "");
  const [kategori, setKategori] = useState(menu?.kategori ?? KATEGORI_OPTIONS[0]);
  const [hargaJual, setHargaJual] = useState(menu?.hargaJual ?? "");
  // Menu lama mungkin punya kategori custom di luar 4 opsi tetap — tetap tampilkan sebagai
  // pilihan supaya edit tidak diam-diam mengganti kategori menu tersebut.
  const kategoriOptions: readonly string[] =
    menu && !(KATEGORI_OPTIONS as readonly string[]).includes(menu.kategori)
      ? [...KATEGORI_OPTIONS, menu.kategori]
      : KATEGORI_OPTIONS;
  const [resep, setResep] = useState<ResepRow[]>(
    menu
      ? menu.resep.map((r) => ({
          bahanBakuId: r.bahanBakuId,
          takaran: r.takaran,
          hanyaBawaPulang: r.hanyaBawaPulang,
        }))
      : [{ bahanBakuId: "", takaran: "", hanyaBawaPulang: false }]
  );

  function updateResepRow(index: number, patch: Partial<ResepRow>) {
    setResep((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addResepRow() {
    setResep((prev) => [...prev, { bahanBakuId: "", takaran: "", hanyaBawaPulang: false }]);
  }

  function removeResepRow(index: number) {
    setResep((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (resep.some((r) => !r.bahanBakuId || !r.takaran)) {
      toast.error("Lengkapi semua baris resep (bahan + takaran)");
      return;
    }
    setLoading(true);
    try {
      const url = mode === "create" ? "/api/menu" : `/api/menu/${menu!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nama, kategori, hargaJual, resep }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan menu");
        return;
      }
      toast.success(mode === "create" ? "Menu berhasil ditambahkan" : "Menu berhasil diperbarui");
      onOpenChange(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{mode === "create" ? "Menu Baru" : `Edit ${menu?.nama}`}</DialogTitle>
        <DialogDescription>HPP dan keuntungan dihitung otomatis dari resep yang dipilih.</DialogDescription>
      </DialogHeader>
      <div className="flex flex-col gap-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="nama">Nama Menu</Label>
            <Input id="nama" required value={nama} onChange={(e) => setNama(e.target.value)} placeholder="Es Kopi Susu" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="kategori">Kategori</Label>
            <Select value={kategori} onValueChange={(v) => setKategori(v ?? "")}>
              <SelectTrigger id="kategori" className="w-full">
                <SelectValue placeholder="Pilih kategori">{(value: string) => formatKategori(value)}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {kategoriOptions.map((k) => (
                  <SelectItem key={k} value={k}>
                    {formatKategori(k)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hargaJual">Harga Jual</Label>
          <Input id="hargaJual" type="number" min="0" step="any" required value={hargaJual} onChange={(e) => setHargaJual(e.target.value)} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Resep</Label>
            <Button type="button" variant="outline" size="sm" onClick={addResepRow}>
              <Plus className="size-3.5" />
              Tambah Bahan
            </Button>
          </div>
          <div className="flex flex-col gap-2">
            {resep.map((row, index) => {
              const bahan = bahanBaku.find((b) => b.id === row.bahanBakuId);
              return (
                <div key={index} className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] gap-2 sm:flex sm:items-center">
                  <Select value={row.bahanBakuId} onValueChange={(v) => updateResepRow(index, { bahanBakuId: v ?? "" })}>
                    <SelectTrigger className="col-span-3 min-w-0 sm:flex-1">
                      <SelectValue placeholder="Pilih bahan">{() => bahan?.nama ?? "Pilih bahan"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {bahanBaku.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={row.hanyaBawaPulang ? "bawa-pulang" : "selalu"}
                    onValueChange={(value) => updateResepRow(index, { hanyaBawaPulang: value === "bawa-pulang" })}
                  >
                    <SelectTrigger className="col-span-3 w-full sm:w-36 sm:shrink-0">
                      <SelectValue>{row.hanyaBawaPulang ? "Bawa pulang" : "Selalu dipakai"}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="selalu">Selalu dipakai</SelectItem>
                      <SelectItem value="bawa-pulang">Hanya bawa pulang</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Takaran"
                    className="w-full sm:w-28"
                    value={row.takaran}
                    onChange={(e) => updateResepRow(index, { takaran: e.target.value })}
                  />
                  <span className="col-start-2 row-start-3 w-10 self-center text-xs text-muted-foreground sm:col-auto sm:row-auto">
                    {bahan?.satuan ?? ""}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Hapus bahan"
                    disabled={resep.length === 1}
                    className="col-start-3 row-start-3 justify-self-center"
                    onClick={() => removeResepRow(index)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              );
            })}
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
