"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import { HutangDetailDialog } from "./hutang-detail-dialog";
import type { listHutang, getHutangDetail } from "@/lib/queries/hutang";

type HutangRow = Awaited<ReturnType<typeof listHutang>>[number];
type HutangDetail = NonNullable<Awaited<ReturnType<typeof getHutangDetail>>>;

export function HutangList({ data }: { data: HutangRow[] }) {
  const router = useRouter();
  const [tab, setTab] = useState<"belum_lunas" | "lunas">("belum_lunas");
  const [lunasTarget, setLunasTarget] = useState<HutangRow | null>(null);
  const [loadingLunas, setLoadingLunas] = useState(false);
  const [detailFor, setDetailFor] = useState<HutangRow | null>(null);
  const [detail, setDetail] = useState<HutangDetail | undefined>(undefined);

  const jumlahBelumLunas = useMemo(() => data.filter((h) => h.status === "belum_lunas").length, [data]);
  const filtered = data.filter((h) => h.status === tab);
  const totalBelumLunas = useMemo(
    () => data.filter((h) => h.status === "belum_lunas").reduce((sum, h) => sum + Number(h.jumlah), 0),
    [data]
  );

  async function openDetail(row: HutangRow) {
    setDetailFor(row);
    setDetail(undefined);
    const res = await fetch(`/api/hutang/${row.id}`);
    const json = await res.json();
    if (res.ok) setDetail(json.data);
    else toast.error(json.error ?? "Gagal memuat detail hutang");
  }

  async function handleTandaiLunas() {
    if (!lunasTarget) return;
    setLoadingLunas(true);
    try {
      const res = await fetch(`/api/hutang/${lunasTarget.id}/lunas`, { method: "POST" });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error ?? "Gagal menandai hutang lunas");
        return;
      }
      toast.success("Hutang ditandai lunas, pemasukan tercatat di Keuangan");
      setLunasTarget(null);
      router.refresh();
    } finally {
      setLoadingLunas(false);
    }
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
                  <Currency value={h.jumlah} className="font-medium" />
                  {h.status === "belum_lunas" && (
                    <Button size="sm" onClick={() => setLunasTarget(h)}>
                      Tandai Lunas
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <HutangDetailDialog detail={detail} open={detailFor !== null} onOpenChange={(open) => !open && setDetailFor(null)} />

      <AlertDialog open={lunasTarget !== null} onOpenChange={(open) => !open && setLunasTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tandai lunas — {lunasTarget?.namaPelanggan || "Tanpa nama"}?</AlertDialogTitle>
            <AlertDialogDescription>
              Setelah ditandai lunas, pemasukan sebesar <Currency value={lunasTarget?.jumlah ?? 0} /> akan tercatat di
              modul Keuangan dengan tanggal hari ini.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={handleTandaiLunas} disabled={loadingLunas}>
              {loadingLunas ? "Memproses..." : "Tandai Lunas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
