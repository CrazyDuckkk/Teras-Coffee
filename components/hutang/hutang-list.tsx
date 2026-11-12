"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import { HutangDetailDialog } from "./hutang-detail-dialog";
import { PembayaranHutangDialog } from "./pembayaran-hutang-dialog";
import type { listHutang, getHutangDetail } from "@/lib/queries/hutang";
import type { UserRole } from "@/lib/roles";

type HutangRow = Awaited<ReturnType<typeof listHutang>>[number];
type HutangDetail = NonNullable<Awaited<ReturnType<typeof getHutangDetail>>>;

export function HutangList({ data, peran }: { data: HutangRow[]; peran: UserRole }) {
  const router = useRouter();
  const [tab, setTab] = useState<"belum_lunas" | "lunas">("belum_lunas");
  const [bayarTarget, setBayarTarget] = useState<HutangRow | null>(null);
  const [detailFor, setDetailFor] = useState<HutangRow | null>(null);
  const [detail, setDetail] = useState<HutangDetail | undefined>(undefined);

  const jumlahBelumLunas = useMemo(() => data.filter((h) => h.status === "belum_lunas").length, [data]);
  const filtered = data.filter((h) => h.status === tab);
  const totalBelumLunas = useMemo(
    () => data.filter((h) => h.status === "belum_lunas").reduce((sum, h) => sum + Number(h.sisa), 0),
    [data]
  );

  async function muatDetail(id: string) {
    try {
      const res = await fetch(`/api/hutang/${id}`);
      const json = await res.json();
      if (res.ok) setDetail(json.data);
      else toast.error(json.error ?? "Gagal memuat detail hutang");
    } catch {
      toast.error("Tidak dapat menghubungi server. Coba lagi.");
    }
  }

  async function openDetail(row: HutangRow) {
    setDetailFor(row);
    setDetail(undefined);
    await muatDetail(row.id);
  }

  return (
    <div className="flex flex-col gap-4">
      {jumlahBelumLunas > 0 && (
        <div className="rounded-xl border border-[#E2E8F0] bg-card p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          <span className="text-sm text-muted-foreground">Total Belum Lunas</span>
          <Currency value={totalBelumLunas} className="block text-2xl font-semibold text-danger-foreground" />
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab((v as typeof tab) ?? "belum_lunas")}>
        <TabsList>
          <TabsTrigger value="belum_lunas">Belum Lunas ({jumlahBelumLunas})</TabsTrigger>
          <TabsTrigger value="lunas">Lunas</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-16 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          {tab === "belum_lunas" ? "Tidak ada hutang yang belum lunas." : "Belum ada hutang yang lunas."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((h) => (
            <Card key={h.id} className="rounded-xl border-[#E2E8F0] py-3 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
              <CardContent className="flex items-center justify-between gap-3 px-4">
                <button
                  type="button"
                  onClick={() => openDetail(h)}
                  className="flex flex-1 flex-col items-start gap-1 text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{h.namaPelanggan || "Tanpa nama"}</span>
                    {h.status === "lunas" ? (
                      <Badge className="bg-success text-success-foreground">Lunas</Badge>
                    ) : (
                      <Badge className="bg-warning text-warning-foreground">Belum Lunas</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {h.status === "lunas" && h.tanggalLunas
                      ? `Dilunasi ${formatTanggalWaktuWIB(new Date(h.tanggalLunas))}`
                      : formatTanggalWaktuWIB(new Date(h.tanggalHutang))}
                  </span>
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-end">
                    <Currency value={h.status === "lunas" ? h.jumlah : h.sisa} className="font-medium" />
                    {h.status === "belum_lunas" && Number(h.dibayar) > 0 && (
                      <span className="text-xs text-muted-foreground">
                        dari <Currency value={h.jumlah} />
                      </span>
                    )}
                  </div>
                  {h.status === "belum_lunas" && (
                    <Button size="sm" onClick={() => setBayarTarget(h)}>
                      Bayar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <HutangDetailDialog
        detail={detail}
        open={detailFor !== null}
        onOpenChange={(open) => !open && setDetailFor(null)}
        peran={peran}
        onBerubah={() => {
          if (detailFor) void muatDetail(detailFor.id);
          router.refresh();
        }}
      />

      <PembayaranHutangDialog hutang={bayarTarget} onOpenChange={(open) => !open && setBayarTarget(null)} />
    </div>
  );
}
