import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { db } from "@/db";
import {
  bahanBaku,
  hutang,
  hutangPembayaran,
  pengajuanVoid,
  pengaturan,
  penyesuaianStok,
  stockMasuk,
  transaksi,
  tutupKasir,
  user,
} from "@/db/schema";
import { KUNCI_JADWAL_TUTUP_KASIR } from "@/lib/tutup-kasir-core";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface AktivitasRow {
  id: string;
  waktu: Date;
  pelakuNama: string | null;
  aksi: string;
  detail: string;
}

function labelMetode(metode: "tunai" | "qris" | "hutang") {
  return metode === "qris" ? "QRIS" : metode === "hutang" ? "Hutang" : "Tunai";
}

const jenisPenyesuaianLabels: Record<string, string> = {
  menu_tumpah: "Menu tumpah",
  menu_gagal: "Menu gagal dibuat",
  kalibrasi: "Kalibrasi stok",
  tes_rasa: "Tes rasa",
  rusak: "Bahan rusak",
  kedaluwarsa: "Bahan kedaluwarsa",
  opname: "Opname stok",
};

export async function listAktivitasCore(query: DbOrTx, limit = 40): Promise<AktivitasRow[]> {
  const transaksiPelaku = alias(user, "aktivitas_transaksi_pelaku");
  const transaksiPembatal = alias(user, "aktivitas_transaksi_pembatal");
  const pengajuanPelaku = alias(user, "aktivitas_pengajuan_pelaku");
  const pengajuanPemutus = alias(user, "aktivitas_pengajuan_pemutus");
  const stockPelaku = alias(user, "aktivitas_stock_pelaku");
  const stockPemutus = alias(user, "aktivitas_stock_pemutus");
  const stockPembatal = alias(user, "aktivitas_stock_pembatal");
  const pembayaranPelaku = alias(user, "aktivitas_pembayaran_pelaku");
  const pembayaranPembatal = alias(user, "aktivitas_pembayaran_pembatal");

  const [transaksiRows, pengajuanRows, stockRows, pembayaranRows, penyesuaianRows, tutupRows, pengaturanRows] =
    await Promise.all([
      query
        .select({
          id: transaksi.id,
          dibuatPada: transaksi.createdAt,
          voidedAt: transaksi.voidedAt,
          metode: transaksi.metodeBayar,
          total: transaksi.totalPemasukan,
          alasanVoid: transaksi.voidReason,
          pelakuNama: transaksiPelaku.name,
          pembatalNama: transaksiPembatal.name,
        })
        .from(transaksi)
        .leftJoin(transaksiPelaku, eq(transaksiPelaku.id, transaksi.pelakuId))
        .leftJoin(transaksiPembatal, eq(transaksiPembatal.id, transaksi.voidedBy))
        .where(or(isNotNull(transaksi.pelakuId), isNotNull(transaksi.voidedBy)))
        .orderBy(desc(sql`coalesce(${transaksi.voidedAt}, ${transaksi.createdAt})`))
        .limit(limit),
      query
        .select({
          id: pengajuanVoid.id,
          diajukanAt: pengajuanVoid.diajukanAt,
          diputuskanAt: pengajuanVoid.diputuskanAt,
          status: pengajuanVoid.status,
          alasan: pengajuanVoid.alasan,
          diajukanOlehNama: pengajuanPelaku.name,
          diputuskanOlehNama: pengajuanPemutus.name,
        })
        .from(pengajuanVoid)
        .leftJoin(pengajuanPelaku, eq(pengajuanPelaku.id, pengajuanVoid.diajukanOleh))
        .leftJoin(pengajuanPemutus, eq(pengajuanPemutus.id, pengajuanVoid.diputuskanOleh))
        .where(or(isNotNull(pengajuanVoid.diajukanOleh), isNotNull(pengajuanVoid.diputuskanOleh)))
        .orderBy(desc(sql`coalesce(${pengajuanVoid.diputuskanAt}, ${pengajuanVoid.diajukanAt})`))
        .limit(limit),
      query
        .select({
          id: stockMasuk.id,
          tanggal: stockMasuk.tanggal,
          konfirmasiHargaAt: stockMasuk.konfirmasiHargaAt,
          dibatalkanAt: stockMasuk.dibatalkanAt,
          statusHarga: stockMasuk.statusHarga,
          alasanBatal: stockMasuk.alasanBatal,
          bahanNama: bahanBaku.nama,
          pelakuNama: stockPelaku.name,
          pemutusNama: stockPemutus.name,
          pembatalNama: stockPembatal.name,
        })
        .from(stockMasuk)
        .innerJoin(bahanBaku, eq(bahanBaku.id, stockMasuk.bahanBakuId))
        .leftJoin(stockPelaku, eq(stockPelaku.id, stockMasuk.pelakuId))
        .leftJoin(stockPemutus, eq(stockPemutus.id, stockMasuk.konfirmasiHargaOleh))
        .leftJoin(stockPembatal, eq(stockPembatal.id, stockMasuk.dibatalkanOleh))
        .where(
          or(
            isNotNull(stockMasuk.pelakuId),
            isNotNull(stockMasuk.konfirmasiHargaOleh),
            isNotNull(stockMasuk.dibatalkanOleh),
          ),
        )
        .orderBy(desc(sql`coalesce(${stockMasuk.dibatalkanAt}, ${stockMasuk.konfirmasiHargaAt}, ${stockMasuk.tanggal})`))
        .limit(limit),
      query
        .select({
          id: hutangPembayaran.id,
          dibayarAt: hutangPembayaran.dibayarAt,
          dibatalkanAt: hutangPembayaran.dibatalkanAt,
          jumlah: hutangPembayaran.jumlah,
          metode: hutangPembayaran.metode,
          alasanBatal: hutangPembayaran.alasanBatal,
          namaPelanggan: hutang.namaPelanggan,
          pelakuNama: pembayaranPelaku.name,
          pembatalNama: pembayaranPembatal.name,
        })
        .from(hutangPembayaran)
        .innerJoin(hutang, eq(hutang.id, hutangPembayaran.hutangId))
        .leftJoin(pembayaranPelaku, eq(pembayaranPelaku.id, hutangPembayaran.pelakuId))
        .leftJoin(pembayaranPembatal, eq(pembayaranPembatal.id, hutangPembayaran.dibatalkanOleh))
        .where(or(isNotNull(hutangPembayaran.pelakuId), isNotNull(hutangPembayaran.dibatalkanOleh)))
        .orderBy(desc(sql`coalesce(${hutangPembayaran.dibatalkanAt}, ${hutangPembayaran.dibayarAt})`))
        .limit(limit),
      query
        .select({
          id: penyesuaianStok.id,
          waktu: penyesuaianStok.createdAt,
          jenis: penyesuaianStok.jenis,
          alasan: penyesuaianStok.alasan,
          pelakuNama: user.name,
        })
        .from(penyesuaianStok)
        .leftJoin(user, eq(user.id, penyesuaianStok.pelakuId))
        .where(isNotNull(penyesuaianStok.pelakuId))
        .orderBy(desc(penyesuaianStok.createdAt))
        .limit(limit),
      query
        .select({
          id: tutupKasir.id,
          waktu: tutupKasir.createdAt,
          tanggal: tutupKasir.tanggal,
          pelakuNama: user.name,
        })
        .from(tutupKasir)
        .leftJoin(user, eq(user.id, tutupKasir.pelakuId))
        .where(isNotNull(tutupKasir.pelakuId))
        .orderBy(desc(tutupKasir.createdAt))
        .limit(limit),
      query
        .select({
          id: pengaturan.kunci,
          waktu: pengaturan.diperbaruiPada,
          pelakuNama: user.name,
        })
        .from(pengaturan)
        .leftJoin(user, eq(user.id, pengaturan.diperbaruiOlehId))
        .where(and(eq(pengaturan.kunci, KUNCI_JADWAL_TUTUP_KASIR), isNotNull(pengaturan.diperbaruiOlehId)))
        .limit(1),
    ]);

  const aktivitas: AktivitasRow[] = [
    ...transaksiRows.flatMap((row) => [
      ...(row.pelakuNama
        ? [{
            id: `transaksi:${row.id}:dibuat`,
            waktu: row.dibuatPada,
            pelakuNama: row.pelakuNama,
            aksi: "Transaksi dicatat",
            detail: `${labelMetode(row.metode)} · Rp ${Number(row.total).toLocaleString("id-ID")}`,
          }]
        : []),
      ...(row.voidedAt && row.pembatalNama
        ? [{
            id: `transaksi:${row.id}:void`,
            waktu: row.voidedAt,
            pelakuNama: row.pembatalNama,
            aksi: "Transaksi di-void",
            detail: row.alasanVoid ?? "Transaksi dibatalkan",
          }]
        : []),
    ]),
    ...pengajuanRows.flatMap((row) => [
      ...(row.diajukanOlehNama
        ? [{
            id: `pengajuan-void:${row.id}:diajukan`,
            waktu: row.diajukanAt,
            pelakuNama: row.diajukanOlehNama,
            aksi: "Pengajuan void diajukan",
            detail: row.alasan,
          }]
        : []),
      ...(row.diputuskanAt && row.diputuskanOlehNama
        ? [{
            id: `pengajuan-void:${row.id}:keputusan`,
            waktu: row.diputuskanAt,
            pelakuNama: row.diputuskanOlehNama,
            aksi: row.status === "disetujui" ? "Pengajuan void disetujui" : "Pengajuan void ditolak",
            detail: row.alasan,
          }]
        : []),
    ]),
    ...stockRows.flatMap((row) => [
      ...(row.pelakuNama
        ? [{
            id: `stock-masuk:${row.id}:dicatat`,
            waktu: row.tanggal,
            pelakuNama: row.pelakuNama,
            aksi: "Stock Masuk dicatat",
            detail: row.bahanNama,
          }]
        : []),
      ...(row.konfirmasiHargaAt &&
      row.konfirmasiHargaAt.getTime() > row.tanggal.getTime() &&
      row.pemutusNama
        ? [{
            id: `stock-masuk:${row.id}:harga`,
            waktu: row.konfirmasiHargaAt,
            pelakuNama: row.pemutusNama,
            aksi: row.statusHarga === "disetujui"
              ? "Harga Stock Masuk disetujui"
              : "Harga Stock Masuk ditolak",
            detail: row.bahanNama,
          }]
        : []),
      ...(row.dibatalkanAt && row.pembatalNama
        ? [{
            id: `stock-masuk:${row.id}:koreksi`,
            waktu: row.dibatalkanAt,
            pelakuNama: row.pembatalNama,
            aksi: "Stock Masuk dikoreksi",
            detail: row.alasanBatal ?? row.bahanNama,
          }]
        : []),
    ]),
    ...pembayaranRows.flatMap((row) => [
      ...(row.pelakuNama
        ? [{
            id: `pembayaran-hutang:${row.id}:dibayar`,
            waktu: row.dibayarAt,
            pelakuNama: row.pelakuNama,
            aksi: "Pembayaran hutang dicatat",
            detail: `${row.namaPelanggan ?? "Tanpa nama"} · Rp ${Number(row.jumlah).toLocaleString("id-ID")} · ${labelMetode(row.metode)}`,
          }]
        : []),
      ...(row.dibatalkanAt && row.pembatalNama
        ? [{
            id: `pembayaran-hutang:${row.id}:dibatalkan`,
            waktu: row.dibatalkanAt,
            pelakuNama: row.pembatalNama,
            aksi: "Pembayaran hutang dibatalkan",
            detail: row.alasanBatal ?? row.namaPelanggan ?? "Pembayaran dibatalkan",
          }]
        : []),
    ]),
    ...penyesuaianRows.map((row) => ({
      id: `penyesuaian-stok:${row.id}`,
      waktu: row.waktu,
      pelakuNama: row.pelakuNama,
      aksi: jenisPenyesuaianLabels[row.jenis] ?? "Penyesuaian stok",
      detail: row.alasan,
    })),
    ...tutupRows.map((row) => ({
      id: `tutup-kasir:${row.id}`,
      waktu: row.waktu,
      pelakuNama: row.pelakuNama,
      aksi: "Tutup kasir manual",
      detail: `Tanggal ${row.tanggal}`,
    })),
    ...pengaturanRows.map((row) => ({
      id: `pengaturan:${row.id}`,
      waktu: row.waktu,
      pelakuNama: row.pelakuNama,
      aksi: "Jam tutup otomatis diubah",
      detail: "Jadwal perubahan berlaku mulai hari berikutnya.",
    })),
  ];

  return aktivitas
    .filter((row) => row.pelakuNama !== null)
    .sort((a, b) => b.waktu.getTime() - a.waktu.getTime())
    .slice(0, limit);
}
