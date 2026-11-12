"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatTanggalWaktuWIB } from "@/lib/date";

interface PengaturanJamTutup {
  jamAktif: string;
  berikutnya: { jam: string; berlakuMulai: string } | null;
  diperbaruiPada: Date | string | null;
  diperbaruiOlehNama: string | null;
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

export function JamTutupKasirPanel({ pengaturan }: { pengaturan: PengaturanJamTutup }) {
  const router = useRouter();
  const [jam, setJam] = useState(pengaturan.berikutnya?.jam ?? pengaturan.jamAktif);
  const [loading, setLoading] = useState(false);

  async function handleSimpan() {
    setLoading(true);
    try {
      const response = await fetch("/api/pengaturan/jam-tutup-kasir", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jam }),
      });
      const result: unknown = await response.json();
      if (!response.ok) {
        toast.error(getErrorMessage(result, "Gagal mengubah jam tutup otomatis"));
        return;
      }

      toast.success("Jam tutup otomatis dijadwalkan mulai besok");
      router.refresh();
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Jam Tutup Otomatis</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="jam-tutup-kasir">Jam (WIB)</Label>
          <div className="flex flex-wrap items-end gap-3">
            <Input
              id="jam-tutup-kasir"
              type="time"
              required
              value={jam}
              onChange={(event) => setJam(event.target.value)}
              className="w-40"
            />
            <Button onClick={handleSimpan} disabled={loading || !jam}>
              {loading ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            Jam aktif: {pengaturan.jamAktif} WIB. Perubahan berlaku mulai hari berikutnya.
            {pengaturan.berikutnya
              ? ` Jam ${pengaturan.berikutnya.jam} WIB mulai ${pengaturan.berikutnya.berlakuMulai}.`
              : ""}
          </p>
        </div>
        {pengaturan.diperbaruiPada && (
          <p className="text-xs text-muted-foreground">
            Perubahan terakhir oleh {pengaturan.diperbaruiOlehNama ?? "akun yang tidak diketahui"} pada{" "}
            {formatTanggalWaktuWIB(new Date(pengaturan.diperbaruiPada))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
