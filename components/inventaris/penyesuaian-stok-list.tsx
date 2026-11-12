import { Badge } from "@/components/ui/badge";
import { Currency } from "@/components/shared/currency";
import { formatTanggalWaktuWIB } from "@/lib/date";
import type { RiwayatPenyesuaianStok } from "@/lib/queries/inventaris";

const labelJenis: Record<RiwayatPenyesuaianStok["jenis"], string> = {
  menu_tumpah: "Menu tumpah",
  menu_gagal: "Menu gagal dibuat",
  kalibrasi: "Kalibrasi",
  tes_rasa: "Tes rasa",
  rusak: "Bahan rusak",
  kedaluwarsa: "Kedaluwarsa",
  opname: "Opname",
};

export function PenyesuaianStokList({
  data,
  isOwner,
}: {
  data: RiwayatPenyesuaianStok[];
  isOwner: boolean;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div>
        <h2 className="text-lg font-semibold">Riwayat Penyesuaian Stok</h2>
        <p className="text-sm text-muted-foreground">
          Setiap perubahan menyimpan jumlah sebelum dan sesudah beserta pelakunya.
        </p>
      </div>
      {data.length === 0 ? (
        <div className="rounded-xl border border-[#E2E8F0] bg-card py-10 text-center text-sm text-muted-foreground shadow-[0px_1px_3px_rgba(0,0,0,0.05)]">
          Belum ada penyesuaian stok atau opname.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {data.map((row) => (
            <article
              key={row.id}
              className="rounded-xl border border-[#E2E8F0] bg-card p-4 shadow-[0px_1px_3px_rgba(0,0,0,0.05)]"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={row.jenis === "opname" ? "secondary" : "outline"}>{labelJenis[row.jenis]}</Badge>
                <span className="text-xs text-muted-foreground">{formatTanggalWaktuWIB(new Date(row.createdAt))}</span>
                <span className="ml-auto text-xs text-muted-foreground">{row.pelakuNama ?? "Akun lama"}</span>
              </div>
              <div className="mt-2 font-medium">
                {row.menuNama
                  ? `${row.menuNama} · ${row.bawaPulang ? "Bawa pulang" : "Makan di tempat"}`
                  : row.details.length === 1
                    ? row.details[0].bahanNama
                    : "Beberapa bahan"}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{row.alasan}</p>
              <div className="mt-3 divide-y">
                {row.details.map((detail) => {
                  const perubahan = Number(detail.perubahanQty);
                  return (
                    <div
                      key={detail.bahanBakuId}
                      className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2 text-sm first:pt-0 last:pb-0"
                    >
                      <span className="min-w-32 font-medium">{detail.bahanNama}</span>
                      <span className="text-muted-foreground">
                        {perubahan < 0 ? "Berkurang" : "Bertambah"}{" "}
                        {Math.abs(perubahan).toLocaleString("id-ID")} {detail.satuan}
                      </span>
                      <span className="text-muted-foreground">
                        {Number(detail.stokSebelum).toLocaleString("id-ID")} →{" "}
                        {Number(detail.stokSesudah).toLocaleString("id-ID")} {detail.satuan}
                      </span>
                      {isOwner && detail.nilaiSusut !== undefined && (
                        <span className="ml-auto text-muted-foreground">
                          Nilai susut: <Currency value={detail.nilaiSusut} />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
