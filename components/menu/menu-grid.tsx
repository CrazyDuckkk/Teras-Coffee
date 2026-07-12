"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { formatKategori, sortKategoriList } from "@/lib/format";
import { MenuCard } from "./menu-card";
import type { listMenu } from "@/lib/queries/menu";
import type { listBahanBaku } from "@/lib/queries/inventaris";

type MenuWithHpp = Awaited<ReturnType<typeof listMenu>>[number];
type BahanBaku = Awaited<ReturnType<typeof listBahanBaku>>[number];

export function MenuGrid({ data, bahanBaku }: { data: MenuWithHpp[]; bahanBaku: BahanBaku[] }) {
  const kategoriList = useMemo(() => sortKategoriList(data.map((m) => m.kategori)), [data]);
  const [statusTab, setStatusTab] = useState<"aktif" | "nonaktif">("aktif");
  const [activeKategori, setActiveKategori] = useState("semua");
  const [search, setSearch] = useState("");

  const jumlahNonaktif = useMemo(() => data.filter((m) => !m.isActive).length, [data]);
  const byStatus = data.filter((m) => (statusTab === "aktif" ? m.isActive : !m.isActive));
  const byKategori = activeKategori === "semua" ? byStatus : byStatus.filter((m) => m.kategori === activeKategori);
  const query = search.trim().toLowerCase();
  const filtered = query ? byKategori.filter((m) => m.nama.toLowerCase().includes(query)) : byKategori;

  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
        Belum ada menu. Klik &quot;Menu Baru&quot; untuk menambahkan.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs value={statusTab} onValueChange={(v) => setStatusTab((v as typeof statusTab) ?? "aktif")}>
        <TabsList>
          <TabsTrigger value="aktif">Aktif</TabsTrigger>
          <TabsTrigger value="nonaktif">Nonaktif ({jumlahNonaktif})</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        <div className="relative sm:w-64">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama menu..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          {statusTab === "nonaktif" ? "Tidak ada menu yang nonaktif." : "Tidak ada menu yang cocok dengan pencarian."}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((menu) => (
            <MenuCard key={menu.id} menu={menu} bahanBaku={bahanBaku} />
          ))}
        </div>
      )}
    </div>
  );
}
