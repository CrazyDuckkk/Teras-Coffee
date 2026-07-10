"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatKategori } from "@/lib/format";
import { MenuCard } from "./menu-card";
import type { listMenu } from "@/lib/queries/menu";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type MenuWithHpp = Awaited<ReturnType<typeof listMenu>>[number];
type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function MenuGrid({ data, bahanBaku }: { data: MenuWithHpp[]; bahanBaku: BahanBaku[] }) {
  const kategoriList = useMemo(() => Array.from(new Set(data.map((m) => m.kategori))).sort(), [data]);
  const [activeKategori, setActiveKategori] = useState("semua");

  const filtered = activeKategori === "semua" ? data : data.filter((m) => m.kategori === activeKategori);

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada menu. Klik &quot;Menu Baru&quot; untuk menambahkan.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={activeKategori} onValueChange={(v) => setActiveKategori(v ?? "semua")}>
        <TabsList>
          <TabsTrigger value="semua">Semua</TabsTrigger>
          {kategoriList.map((k) => (
            <TabsTrigger key={k} value={k}>
              {formatKategori(k)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((menu) => (
          <MenuCard key={menu.id} menu={menu} bahanBaku={bahanBaku} />
        ))}
      </div>
    </div>
  );
}
