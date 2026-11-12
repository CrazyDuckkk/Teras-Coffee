import { asc, desc, eq, getTableColumns, and, ne, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import { detailTransaksi, hutang, hutangPembayaran, menu, transaksi, user } from "@/db/schema";
import { requireRole } from "@/lib/auth-guard";
import { batalkanPembayaranTx, catatPembayaranTx, hitungSisa } from "@/lib/hutang-core";
import type { PembayaranHutangInput } from "@/lib/validations/hutang";

export {
  HutangSudahAdaPembayaranError,
  HutangSudahLunasError,
  HutangTidakAktifError,
  PembayaranMelebihiSisaError,
  PembayaranSudahDibatalkanError,
} from "@/lib/hutang-core";

export type StatusHutang = "belum_lunas" | "lunas";

/** Total pembayaran aktif (belum dibatalkan) per hutang, dihitung di database. */
const dibayarSql = sql<string>`coalesce((
  select sum(p.jumlah) from hutang_pembayaran p
  where p.hutang_id = ${hutang.id} and p.dibatalkan_at is null
), 0)`;

/** Daftar hutang + jumlah dibayar dan sisa. Hutang milik transaksi yang sudah di-void tidak ditampilkan. */
export async function listHutang(status?: StatusHutang) {
  await requireRole("owner", "cashier");
  const rows = await db
    .select({ ...getTableColumns(hutang), dibayar: dibayarSql })
    .from(hutang)
    .innerJoin(transaksi, eq(transaksi.id, hutang.transaksiId))
    .where(and(ne(transaksi.status, "void"), status ? eq(hutang.status, status) : undefined))
    .orderBy(desc(hutang.tanggalHutang));

  return rows.map((row) => ({ ...row, sisa: hitungSisa(row.jumlah, row.dibayar) }));
}

/** Detail hutang: item transaksi, ringkasan pembayaran, dan riwayat pembayaran (termasuk yang dibatalkan). */
export async function getHutangDetail(id: string) {
  await requireRole("owner", "cashier");
  const [row] = await db
    .select({ ...getTableColumns(hutang), dibayar: dibayarSql })
    .from(hutang)
    .where(eq(hutang.id, id))
    .limit(1);
  if (!row) return null;

  const pembatal = alias(user, "pembatal");
  const [items, pembayaran] = await Promise.all([
    db
      .select({
        menuId: detailTransaksi.menuId,
        qty: detailTransaksi.qty,
        bawaPulang: detailTransaksi.bawaPulang,
        hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
        menuNama: menu.nama,
      })
      .from(detailTransaksi)
      .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
      .where(eq(detailTransaksi.transaksiId, row.transaksiId)),
    db
      .select({
        id: hutangPembayaran.id,
        jumlah: hutangPembayaran.jumlah,
        metode: hutangPembayaran.metode,
        dibayarAt: hutangPembayaran.dibayarAt,
        dibatalkanAt: hutangPembayaran.dibatalkanAt,
        alasanBatal: hutangPembayaran.alasanBatal,
        pelakuNama: user.name,
        pembatalNama: pembatal.name,
      })
      .from(hutangPembayaran)
      .leftJoin(user, eq(user.id, hutangPembayaran.pelakuId))
      .leftJoin(pembatal, eq(pembatal.id, hutangPembayaran.dibatalkanOleh))
      .where(eq(hutangPembayaran.hutangId, id))
      .orderBy(asc(hutangPembayaran.dibayarAt)),
  ]);

  return { ...row, sisa: hitungSisa(row.jumlah, row.dibayar), items, pembayaran };
}

/** Catat pembayaran hutang (owner dan kasir). Kasir mengonfirmasi nama dan jumlah di UI sebelum memanggil ini. */
export async function catatPembayaran(hutangId: string, input: PembayaranHutangInput, pelakuId: string) {
  await requireRole("owner", "cashier");
  return db.transaction((tx) => catatPembayaranTx(tx, hutangId, input, pelakuId));
}

/** Pembatalan pembayaran hanya oleh owner. */
export async function batalkanPembayaran(
  hutangId: string,
  pembayaranId: string,
  alasan: string,
  pelakuId: string,
) {
  await requireRole("owner");
  return db.transaction((tx) => batalkanPembayaranTx(tx, hutangId, pembayaranId, alasan, pelakuId));
}
