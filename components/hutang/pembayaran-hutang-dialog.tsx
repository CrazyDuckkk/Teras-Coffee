"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Currency } from "@/components/shared/currency";
import { cn } from "@/lib/utils";

type Metode = "tunai" | "qris";

export interface HutangUntukDibayar {
  id: string;
  namaPelanggan: string | null;
  sisa: string;
}

/**
 * Dua langkah: (1) isi jumlah dan metode, (2) konfirmasi nama dan jumlah sebelum disimpan
 * (spesifikasi v2, bagian 3.3). Jumlah awal = sisa hutang, jadi satu kali "Lanjut" = pelunasan.
 */
export function PembayaranHutangDialog({
  hutang,
  onOpenChange,
}: {
  hutang: HutangUntukDibayar | null;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [jumlah, setJumlah] = useState("");
  const [metode, setMetode] = useState<Metode>("tunai");
  const [langkah, setLangkah] = useState<"isi" | "konfirmasi">("isi");
  const [loading, setLoading] = useState(false);

  // Isi ulang form setiap dialog dibuka untuk hutang yang berbeda.
  const [hutangId, setHutangId] = useState<string | null>(null);
  if (hutang && hutang.id !== hutangId) {
    setHutangId(hutang.id);
    setJumlah(String(Number(hutang.sisa)));
    setMetode("tunai");
    setLangkah("isi");
  }
  if (!hutang && hutangId !== null) setHutangId(null);

  const sisa = Number(hutang?.sisa ?? 0);
  const jumlahNum = Number(jumlah);
  const jumlahValid = Number.isFinite(jumlahNum) && jumlahNum > 0 && jumlahNum <= sisa;
  const nama = hutang?.namaPelanggan || "Tanpa nama";

  function lanjut() {
    if (!jumlahValid) {
      toast.error(jumlahNum > sisa ? "Jumlah melebihi sisa hutang" : "Masukkan jumlah pembayaran yang valid");
      return;
    }
    setLangkah("konfirmasi");
  }

  async function simpan() {
    if (!hutang) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/hutang/${hutang.id}/pembayaran`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jumlah: jumlahNum, metode }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menyimpan pembayaran");
        setLangkah("isi");
        return;
      }
      toast.success(json.data.lunas ? "Hutang lunas" : "Pembayaran sebagian tersimpan");
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={hutang !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{langkah === "isi" ? "Bayar Hutang" : "Konfirmasi Pembayaran"}</DialogTitle>
          <DialogDescription>
            {langkah === "isi" ? (
              <>
                {nama} — sisa hutang <Currency value={sisa} />
              </>
            ) : (
              "Periksa kembali nama dan jumlah sebelum disimpan."
            )}
          </DialogDescription>
        </DialogHeader>

        {langkah === "isi" ? (
          <div className="flex flex-col gap-4 py-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="jumlah-bayar">Jumlah dibayar</Label>
              <Input
                id="jumlah-bayar"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={jumlah}
                onChange={(e) => setJumlah(e.target.value)}
              />
              <button
                type="button"
                className="self-start text-xs text-primary underline-offset-2 hover:underline"
                onClick={() => setJumlah(String(sisa))}
              >
                Bayar semua sisa
              </button>
            </div>
            <div className="flex flex-col gap-2">
              <Label>Metode</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["tunai", "qris"] as const).map((m) => (
                  <Button
                    key={m}
                    type="button"
                    variant={metode === m ? "default" : "outline"}
                    className={cn("uppercase", metode !== m && "text-muted-foreground")}
                    onClick={() => setMetode(m)}
                  >
                    {m === "tunai" ? "Tunai" : "QRIS"}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2 rounded-lg border border-border p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nama</span>
              <span className="font-medium">{nama}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Jumlah dibayar</span>
              <Currency value={jumlahNum} className="font-semibold" />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Metode</span>
              <span>{metode === "tunai" ? "Tunai" : "QRIS"}</span>
            </div>
            <div className="flex justify-between border-t border-border pt-2">
              <span className="text-muted-foreground">Sisa setelah ini</span>
              <span>
                {sisa - jumlahNum <= 0 ? (
                  <span className="font-medium text-success-foreground">Lunas</span>
                ) : (
                  <Currency value={sisa - jumlahNum} />
                )}
              </span>
            </div>
          </div>
        )}

        <DialogFooter>
          {langkah === "isi" ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Batal
              </Button>
              <Button type="button" onClick={lanjut}>
                Lanjut
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setLangkah("isi")} disabled={loading}>
                Kembali
              </Button>
              <Button type="button" onClick={simpan} disabled={loading}>
                {loading ? "Menyimpan..." : "Simpan Pembayaran"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
