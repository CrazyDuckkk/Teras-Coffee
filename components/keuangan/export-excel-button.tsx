"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { PeriodeLaporan } from "@/lib/laporan-keuangan-core";

export function ExportExcelButton({
  periode,
  tanggal,
  tanggalMulai,
  tanggalAkhir,
}: {
  periode: PeriodeLaporan;
  tanggal: string;
  tanggalMulai: string;
  tanggalAkhir: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleExport() {
    setLoading(true);
    try {
      const response = await fetch("/api/laporan/ekspor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ periode, tanggal }),
      });

      if (!response.ok) {
        const result: unknown = await response.json();
        const error = result && typeof result === "object" && "error" in result && typeof result.error === "string"
          ? result.error
          : "Gagal membuat ekspor laporan";
        toast.error(error);
        return;
      }

      const file = await response.blob();
      const url = URL.createObjectURL(file);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `Laporan_Teras_Coffee_${periode}-${tanggalMulai}-${tanggalAkhir}.xlsx`;
      anchor.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast.success("Laporan Excel berhasil dibuat");
      router.refresh();
    } catch {
      toast.error("Tidak dapat mengunduh laporan. Coba lagi.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button type="button" variant="outline" onClick={handleExport} disabled={loading}>
      {loading ? "Membuat Excel..." : "Ekspor Excel"}
    </Button>
  );
}
