"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { getHutangDetail } from "@/lib/queries/hutang";
import type { UserRole } from "@/lib/roles";

type HutangDetail = NonNullable<Awaited<ReturnType<typeof getHutangDetail>>>;

export function HutangDetailDialog({
  detail,
  open,
  onOpenChange,
  peran,
  onBerubah,
}: {
  detail: HutangDetail | undefined;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  peran: UserRole;
  /** Dipanggil setelah owner membatalkan pembayaran, supaya daftar dan detail dimuat ulang. */
  onBerubah: () => void;
}) {
  const [batalId, setBatalId] = useState<string | null>(null);
  const [alasan, setAlasan] = useState("");
  const [loading, setLoading] = useState(false);

  async function batalkan(hutangId: string, pembayaranId: string) {
    if (!alasan.trim()) {
      toast.error("Alasan pembatalan wajib diisi");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/hutang/${hutangId}/pembayaran/${pembayaranId}/batal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alasan }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal membatalkan pembayaran");
        return;
      }
      toast.success("Pembayaran dibatalkan");
      setBatalId(null);
      setAlasan("");
      onBerubah();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setBatalId(null);
          setAlasan("");
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{detail?.namaPelanggan || "Hutang tanpa nama"}</DialogTitle>
          <DialogDescription>
            {detail ? formatTanggalWaktuWIB(new Date(detail.tanggalHutang)) : "Memuat detail..."}
          </DialogDescription>
        </DialogHeader>

        {!detail ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Memuat...</p>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between rounded-lg border border-border p-3 text-sm">
              <span className="text-muted-foreground">Status</span>
              {detail.status === "lunas" ? (
                <Badge className="bg-success text-success-foreground">
                  Lunas — {detail.tanggalLunas ? formatTanggalWaktuWIB(new Date(detail.tanggalLunas)) : ""}
                </Badge>
              ) : (
                <Badge className="bg-warning text-warning-foreground">Belum Lunas</Badge>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Item Terjual</span>
              <div className="flex flex-col gap-1">
                {detail.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-sm">
                    <span>
                      {item.menuNama} x{item.qty}
                      {item.bawaPulang && <span className="text-muted-foreground"> · Bawa pulang</span>}
                    </span>
                    <Currency value={Number(item.hargaJualSaatItu) * item.qty} />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-1 border-t border-border pt-3 text-sm">
              <div className="flex items-center justify-between">
                <span>Total Hutang</span>
                <Currency value={detail.jumlah} className="font-medium" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Sudah dibayar</span>
                <Currency value={detail.dibayar} />
              </div>
              <div className="flex items-center justify-between font-medium">
                <span>Sisa</span>
                <Currency value={detail.sisa} className="text-lg" />
              </div>
            </div>

            <div className="flex flex-col gap-2 border-t border-border pt-3">
              <span className="text-sm font-medium">Riwayat Pembayaran</span>
              {detail.pembayaran.length === 0 ? (
                <p className="text-sm text-muted-foreground">Belum ada pembayaran.</p>
              ) : (
                detail.pembayaran.map((p) => (
                  <div key={p.id} className="flex flex-col gap-1 rounded-lg border border-border p-2 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className={p.dibatalkanAt ? "text-muted-foreground line-through" : "font-medium"}>
                        <Currency value={p.jumlah} /> · {p.metode === "qris" ? "QRIS" : "Tunai"}
                      </span>
                      {p.dibatalkanAt ? (
                        <Badge variant="outline">Dibatalkan</Badge>
                      ) : (
                        peran === "owner" &&
                        batalId !== p.id && (
                          <Button size="sm" variant="outline" onClick={() => setBatalId(p.id)}>
                            Batalkan
                          </Button>
                        )
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatTanggalWaktuWIB(new Date(p.dibayarAt))}
                      {p.pelakuNama ? ` · ${p.pelakuNama}` : ""}
                    </span>
                    {p.dibatalkanAt && (
                      <span className="text-xs text-muted-foreground">
                        Dibatalkan{p.pembatalNama ? ` oleh ${p.pembatalNama}` : ""}: {p.alasanBatal}
                      </span>
                    )}
                    {batalId === p.id && (
                      <div className="flex flex-col gap-2 pt-1">
                        <Textarea
                          placeholder="Alasan pembatalan (wajib)"
                          value={alasan}
                          onChange={(e) => setAlasan(e.target.value)}
                          maxLength={500}
                        />
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={loading}
                            onClick={() => {
                              setBatalId(null);
                              setAlasan("");
                            }}
                          >
                            Batal
                          </Button>
                          <Button size="sm" disabled={loading} onClick={() => batalkan(detail.id, p.id)}>
                            {loading ? "Memproses..." : "Konfirmasi Pembatalan"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
