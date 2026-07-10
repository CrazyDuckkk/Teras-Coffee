"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatKategori } from "@/lib/format";
import type { MenuRanking } from "@/lib/queries/laporan";

export function MenuTerlarisRanking({ data, kategoriList }: { data: MenuRanking[]; kategoriList: string[] }) {
  const [kategori, setKategori] = useState<string>("semua");

  const filtered = kategori === "semua" ? data : data.filter((r) => r.kategori === kategori);

  return (
    <Card className="rounded-xl border-[#E2E8F0] shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Menu Terlaris</CardTitle>
        {kategoriList.length > 0 && (
          <Select value={kategori} onValueChange={(v) => setKategori(v ?? "semua")}>
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="semua">Semua Kategori</SelectItem>
              {kategoriList.map((k) => (
                <SelectItem key={k} value={k}>
                  {formatKategori(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Belum ada penjualan pada periode ini.</p>
        ) : (
          filtered.map((r, idx) => (
            <div key={r.menuId} className="flex items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3">
                <span className="w-5 shrink-0 text-center font-stat font-semibold text-muted-foreground">
                  {idx + 1}
                </span>
                <div className="flex flex-col">
                  <span className="font-medium">{r.nama}</span>
                  <Badge variant="outline" className="w-fit">
                    {formatKategori(r.kategori)}
                  </Badge>
                </div>
              </div>
              <span className="font-stat tabular-nums text-muted-foreground">{r.qtyTerjual} porsi</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
