"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalculatorIcon, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWIB } from "@/lib/date";

interface PenutupanKasir {
  tanggal: string;
  kasAwal: string | null;
  kasFisik: string | null;
  qrisTerhitung: string | null;
  kasDiharapkan: string | null;
  qrisSistem: string | null;
  selisihKas: string | null;
  selisihQris: string | null;
  catatan: string | null;
  statusPenutupan: "manual" | "otomatis_belum_diverifikasi" | null;
  createdAt: Date | string;
}

function getErrorMessage(value: unknown, fallback: string) {
  if (
    value &&
    typeof value === "object" &&
    "error" in value &&
    typeof value.error === "string"
  ) {
    return value.error;
  }
  return fallback;
}

export function TutupKasirPanel({
  penutupan,
  kasAwalSaran,
}: {
  penutupan: PenutupanKasir | null;
  kasAwalSaran: string | null;
}) {
  const router = useRouter();
  const [kasAwal, setKasAwal] = useState(kasAwalSaran ?? "");
  const [kasFisik, setKasFisik] = useState("");
  const [qrisTerhitung, setQrisTerhitung] = useState("");
  const [catatan, setCatatan] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch("/api/tutup-kasir", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kasAwal: Number(kasAwal),
          kasFisik: Number(kasFisik),
          qrisTerhitung: Number(qrisTerhitung),
          catatan,
        }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(result, "Gagal menutup kasir"));
        return;
      }

      toast.success("Hitung kas berhasil disimpan");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  const otomatis = penutupan?.statusPenutupan === "otomatis_belum_diverifikasi";
  const legacy = penutupan !== null && penutupan.statusPenutupan === null;
  const tanggal = penutupan
    ? new Date(`${penutupan.tanggal}T00:00:00Z`)
    : new Date();

  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">
          Tutup Kasir — {formatTanggalWIB(tanggal)}
        </CardTitle>
        {penutupan ? (
          <Badge
            className={penutupan.statusPenutupan === "manual" ? "bg-success text-success-foreground" : undefined}
            variant={penutupan.statusPenutupan === "manual" ? "default" : "outline"}
          >
            <CheckCircle2 className="size-3" />
            {otomatis
              ? "Otomatis · belum diverifikasi"
              : legacy
                ? "Data penutupan lama"
                : "Sudah ditutup"}
          </Badge>
        ) : (
          <Badge variant="outline">Belum ditutup</Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {legacy ? (
          <p className="text-sm text-muted-foreground">
            Penutupan hari ini berasal dari data lama dan belum memiliki hitungan kas atau QRIS.
          </p>
        ) : penutupan ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">Kas laci</h3>
                <div className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Kas awal</span>
                    <Currency value={penutupan.kasAwal ?? 0} />
                  </div>
                  {penutupan.kasFisik !== null && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Kas fisik</span>
                      <Currency value={penutupan.kasFisik} />
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Kas diharapkan</span>
                    <Currency value={penutupan.kasDiharapkan ?? 0} />
                  </div>
                  {!otomatis && (
                    <div className="flex justify-between gap-4 font-medium">
                      <span>Selisih kas</span>
                      <Currency value={penutupan.selisihKas ?? 0} />
                    </div>
                  )}
                </div>
              </div>
              <div className="rounded-lg border p-4">
                <h3 className="mb-3 text-sm font-semibold">QRIS</h3>
                <div className="grid gap-2 text-sm">
                  {penutupan.qrisTerhitung !== null && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground">Total aplikasi merchant</span>
                      <Currency value={penutupan.qrisTerhitung} />
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Total QRIS sistem</span>
                    <Currency value={penutupan.qrisSistem ?? 0} />
                  </div>
                  {!otomatis && (
                    <div className="flex justify-between gap-4 font-medium">
                      <span>Selisih QRIS</span>
                      <Currency value={penutupan.selisihQris ?? 0} />
                    </div>
                  )}
                </div>
              </div>
            </div>
            {otomatis && (
              <p className="text-sm text-muted-foreground">
                Penutupan otomatis belum diverifikasi. Tidak ada angka selisih karena hitung fisik belum dilakukan.
              </p>
            )}
            {penutupan.catatan && (
              <div className="rounded-lg bg-accent px-4 py-3 text-sm">
                <span className="font-medium">Catatan: </span>
                {penutupan.catatan}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              Masukkan hitungan kas fisik dan total QRIS dari aplikasi merchant sebelum melihat hasil rekonsiliasi.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="kas-awal">Kas awal</Label>
                <Input
                  id="kas-awal"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={kasAwal}
                  onChange={(event) => setKasAwal(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Terisi dari penutupan terakhir; sesuaikan jika perlu.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kas-fisik">Uang fisik di laci</Label>
                <Input
                  id="kas-fisik"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={kasFisik}
                  onChange={(event) => setKasFisik(event.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="qris-terhitung">Total QRIS aplikasi merchant</Label>
                <Input
                  id="qris-terhitung"
                  type="number"
                  min="0"
                  step="0.01"
                  required
                  value={qrisTerhitung}
                  onChange={(event) => setQrisTerhitung(event.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="catatan-tutup">Catatan (opsional)</Label>
              <Input
                id="catatan-tutup"
                maxLength={500}
                value={catatan}
                onChange={(event) => setCatatan(event.target.value)}
              />
            </div>
            <Button className="self-start" type="submit" disabled={loading}>
              <CalculatorIcon className="size-4" />
              {loading ? "Menyimpan..." : "Simpan Hitung Kas"}
            </Button>
            {!kasAwalSaran && (
              <p className="text-xs text-muted-foreground">
                Belum ada hitungan penutupan sebelumnya. Masukkan kas awal secara manual.
              </p>
            )}
          </form>
        )}
      </CardContent>
    </Card>
  );
}
