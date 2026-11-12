"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ExportExcelButton } from "@/components/keuangan/export-excel-button";
import type { PeriodeLaporan } from "@/lib/laporan-keuangan-core";

export function PeriodeLaporanFilter({
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
  const [selectedPeriode, setSelectedPeriode] = useState(periode);
  const [selectedTanggal, setSelectedTanggal] = useState(tanggal);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const tanggalParam = selectedPeriode === "bulanan"
      ? `${selectedTanggal.slice(0, 7)}-01`
      : selectedTanggal;
    router.push(`/keuangan?periode=${selectedPeriode}&tanggal=${tanggalParam}`);
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">Periode kalender</span>
        <select
          value={selectedPeriode}
          onChange={(event) => {
            if (event.target.value === "mingguan" || event.target.value === "bulanan") {
              setSelectedPeriode(event.target.value);
            }
          }}
          className="h-9 rounded-md border border-input bg-background px-3"
        >
          <option value="mingguan">Mingguan (Senin–Minggu)</option>
          <option value="bulanan">Bulanan</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted-foreground">
          {selectedPeriode === "bulanan" ? "Pilih bulan" : "Pilih tanggal dalam minggu"}
        </span>
        <input
          type={selectedPeriode === "bulanan" ? "month" : "date"}
          value={selectedPeriode === "bulanan" ? selectedTanggal.slice(0, 7) : selectedTanggal}
          onChange={(event) => setSelectedTanggal(
            selectedPeriode === "bulanan" ? `${event.target.value}-01` : event.target.value,
          )}
          required
          className="h-9 rounded-md border border-input bg-background px-3"
        />
      </label>
      <Button type="submit" variant="outline">Tampilkan</Button>
      <ExportExcelButton
        periode={periode}
        tanggal={tanggal}
        tanggalMulai={tanggalMulai}
        tanggalAkhir={tanggalAkhir}
      />
    </form>
  );
}
