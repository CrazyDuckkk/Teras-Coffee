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
import type { listStokBahan, listMenuUntukPenyesuaian } from "@/lib/queries/inventaris";

type BahanBaku = Awaited<ReturnType<typeof listStokBahan>>[number];
type MenuAktif = Awaited<ReturnType<typeof listMenuUntukPenyesuaian>>[number];
type JenisPenyesuaian = "menu_tumpah" | "menu_gagal" | "kalibrasi" | "tes_rasa" | "rusak" | "kedaluwarsa";

export function PenyesuaianStokDialog({
  open,
  onOpenChange,
  bahanBaku,
  menuAktif,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bahanBaku: BahanBaku[];
  menuAktif: MenuAktif[];
}) {
  const router = useRouter();
  const [jenis, setJenis] = useState<JenisPenyesuaian>("menu_tumpah");
  const [menuId, setMenuId] = useState("");
  const [bawaPulang, setBawaPulang] = useState(false);
  const [bahanBakuId, setBahanBakuId] = useState("");
  const [qty, setQty] = useState("");
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);
  const menuTerbuang = jenis === "menu_tumpah" || jenis === "menu_gagal";

  function resetForm() {
    setJenis("menu_tumpah");
    setMenuId("");
    setBawaPulang(false);
    setBahanBakuId("");
    setQty("");
    setAlasan("");
  }

  function closeDialog() {
    if (loading) return;
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = menuTerbuang
      ? { jenis, menuId, bawaPulang, alasan }
      : { jenis, bahanBakuId, qty, alasan };

    setLoading(true);
    try {
      const response = await fetch("/api/penyesuaian-stok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok) {
        toast.error(result.error ?? "Gagal mencatat penyesuaian stok");
        return;
      }

      toast.success("Penyesuaian stok berhasil dicatat");
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

  const bahanTerpilih = bahanBaku.find((item) => item.id === bahanBakuId);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && closeDialog()}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Catat Penyesuaian Stok</DialogTitle>
            <DialogDescription>
              Perubahan langsung mengurangi stok dan tercatat beserta alasan serta pelakunya.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jenis-penyesuaian">Jenis penyesuaian</Label>
              <Select
                value={jenis}
                onValueChange={(value) => {
                  if (
                    value === "menu_tumpah" ||
                    value === "menu_gagal" ||
                    value === "kalibrasi" ||
                    value === "tes_rasa" ||
                    value === "rusak" ||
                    value === "kedaluwarsa"
                  ) {
                    setJenis(value);
                  }
                }}
              >
                <SelectTrigger id="jenis-penyesuaian" className="w-full">
                  <SelectValue>
                    {(value: string | null) =>
                      value === "menu_tumpah"
                        ? "Menu tumpah"
                        : value === "menu_gagal"
                          ? "Menu gagal dibuat"
                          : value === "kalibrasi"
                            ? "Kalibrasi"
                            : value === "tes_rasa"
                              ? "Tes rasa"
                              : value === "rusak"
                                ? "Bahan rusak"
                                : "Kedaluwarsa"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="menu_tumpah">Menu tumpah</SelectItem>
                  <SelectItem value="menu_gagal">Menu gagal dibuat</SelectItem>
                  <SelectItem value="kalibrasi">Kalibrasi</SelectItem>
                  <SelectItem value="tes_rasa">Tes rasa</SelectItem>
                  <SelectItem value="rusak">Bahan rusak</SelectItem>
                  <SelectItem value="kedaluwarsa">Kedaluwarsa</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {menuTerbuang ? (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="menu-penyesuaian">Menu</Label>
                  <Select value={menuId} onValueChange={(value) => setMenuId(value ?? "")}>
                    <SelectTrigger id="menu-penyesuaian" className="w-full">
                      <SelectValue placeholder="Pilih menu">
                        {(value: string | null) =>
                          menuAktif.find((item) => item.id === value)?.nama ?? "Pilih menu"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {menuAktif.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="mode-menu-penyesuaian">Mode pesanan</Label>
                  <Select
                    value={bawaPulang ? "bawa_pulang" : "makan_di_tempat"}
                    onValueChange={(value) => {
                      if (value === "bawa_pulang") setBawaPulang(true);
                      if (value === "makan_di_tempat") setBawaPulang(false);
                    }}
                  >
                    <SelectTrigger id="mode-menu-penyesuaian" className="w-full">
                      <SelectValue>
                        {(value: string | null) =>
                          value === "bawa_pulang" ? "Bawa pulang" : "Makan di tempat"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="makan_di_tempat">Makan di tempat</SelectItem>
                      <SelectItem value="bawa_pulang">Bawa pulang</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Satu porsi resep dipotong; bahan kemasan hanya ikut untuk mode bawa pulang.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="bahan-penyesuaian">Bahan baku</Label>
                  <Select value={bahanBakuId} onValueChange={(value) => setBahanBakuId(value ?? "")}>
                    <SelectTrigger id="bahan-penyesuaian" className="w-full">
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
                <div className="flex flex-col gap-2">
                  <Label htmlFor="qty-penyesuaian">Jumlah {bahanTerpilih ? `(${bahanTerpilih.satuan})` : ""}</Label>
                  <Input
                    id="qty-penyesuaian"
                    type="number"
                    min="0"
                    step="0.01"
                    required
                    value={qty}
                    onChange={(event) => setQty(event.target.value)}
                    placeholder="Jumlah yang terbuang"
                  />
                </div>
              </>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="alasan-penyesuaian">Alasan</Label>
              <Input
                id="alasan-penyesuaian"
                required
                minLength={3}
                maxLength={500}
                value={alasan}
                onChange={(event) => setAlasan(event.target.value)}
                placeholder="Jelaskan penyebab penyesuaian"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={closeDialog}>
              Batal
            </Button>
            <Button
              type="submit"
              disabled={
                loading ||
                (menuTerbuang && (!menuId || menuAktif.length === 0)) ||
                (!menuTerbuang && (!bahanBakuId || bahanBaku.length === 0))
              }
            >
              {loading ? "Menyimpan..." : "Catat penyesuaian"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
