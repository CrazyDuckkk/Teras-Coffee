import { and, asc, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  bahanBaku,
  detailTransaksi,
  detailTransaksiBahan,
  hutang,
  menu,
  pengajuanVoid,
  resepMenu,
  riwayatHargaBahan,
  transaksi,
  user,
} from "@/db/schema";
import { getRangeLastNDaysWIB } from "@/lib/date";
import { batalkanHutangSaatVoidTx, pastikanHutangBisaDiajukanVoidTx } from "@/lib/hutang-core";
import { siapkanPencatatanKasTx } from "@/lib/tutup-kasir-core";
import type { TransaksiCreateInput } from "@/lib/validations/transaksi";
import { requireRole } from "@/lib/auth-guard";
import {
  aggregateConsumptionSnapshots,
  calculateRecipeHpp,
  getRecipeConsumptionSnapshots,
  getRequiredIngredients,
} from "@/lib/transaction-recipes";

export class StokTidakCukupError extends Error {
  constructor(public shortages: { nama: string; butuh: number; tersedia: number; satuan: string }[]) {
    super(
      `Stok tidak cukup untuk: ${shortages
        .map((s) => `${s.nama} (butuh ${s.butuh}${s.satuan}, tersedia ${s.tersedia}${s.satuan})`)
        .join(", ")}`
    );
    this.name = "StokTidakCukupError";
  }
}

export class MenuTidakAktifError extends Error {
  constructor() {
    super("Salah satu menu di keranjang sudah tidak tersedia. Muat ulang halaman dan coba lagi.");
    this.name = "MenuTidakAktifError";
  }
}

export class TransaksiSudahVoidError extends Error {
  constructor() {
    super("Transaksi ini sudah di-void sebelumnya.");
    this.name = "TransaksiSudahVoidError";
  }
}

export class PengajuanVoidSedangMenungguError extends Error {
  constructor() {
    super("Transaksi ini sedang menunggu keputusan owner.");
    this.name = "PengajuanVoidSedangMenungguError";
  }
}

export class TransaksiTidakDapatDiajukanVoidError extends Error {
  constructor() {
    super("Transaksi ini tidak dapat diajukan untuk void.");
    this.name = "TransaksiTidakDapatDiajukanVoidError";
  }
}

export class PengajuanVoidSudahDiprosesError extends Error {
  constructor() {
    super("Pengajuan void ini sudah diproses.");
    this.name = "PengajuanVoidSudahDiprosesError";
  }
}

/** Data untuk halaman kasir: menu aktif + resep per menu (dipakai validasi stok di client) + stok bahan saat ini. */
export async function getKasirData() {
  await requireRole("owner", "cashier");
  const [menus, resep, bahan] = await Promise.all([
    db.select().from(menu).where(eq(menu.isActive, true)).orderBy(menu.kategori, menu.nama),
    db
      .select({
        menuId: resepMenu.menuId,
        bahanBakuId: resepMenu.bahanBakuId,
        takaran: resepMenu.takaran,
        hanyaBawaPulang: resepMenu.hanyaBawaPulang,
      })
      .from(resepMenu)
      .innerJoin(menu, eq(menu.id, resepMenu.menuId))
      .where(eq(menu.isActive, true)),
    db.select().from(bahanBaku).where(eq(bahanBaku.isActive, true)),
  ]);

  return { menus, resep, bahan };
}

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

function hargaAktifSubquery(tx: DbOrTx) {
  return tx
    .selectDistinctOn([riwayatHargaBahan.bahanBakuId], {
      bahanBakuId: riwayatHargaBahan.bahanBakuId,
      hargaPerSatuan: riwayatHargaBahan.hargaPerSatuan,
    })
    .from(riwayatHargaBahan)
    .where(isNull(riwayatHargaBahan.dibatalkanAt))
    .orderBy(riwayatHargaBahan.bahanBakuId, desc(riwayatHargaBahan.berlakuSejak), desc(riwayatHargaBahan.createdAt))
    .as("harga_aktif");
}

/**
 * Simpan transaksi penjualan — transactional:
 * cek ketersediaan stok agregat per bahan (lintas item cart) -> decrement stok
 * -> snapshot harga_jual & hpp saat itu -> insert transaksi + detail_transaksi.
 * Gagal total (rollback) kalau ada bahan kurang.
 */
export async function createTransaksi(input: TransaksiCreateInput, pelakuId: string) {
  await requireRole("owner", "cashier");
  return db.transaction(async (tx) => {
    const { timestamp: now, setelahTutup } = await siapkanPencatatanKasTx(tx);
    const menuIds = [...new Set(input.items.map((i) => i.menuId))];

    const menuRows = await tx.select().from(menu).where(inArray(menu.id, menuIds));
    const menuMap = new Map(menuRows.map((m) => [m.id, m]));
    for (const id of menuIds) {
      const m = menuMap.get(id);
      if (!m || !m.isActive) throw new MenuTidakAktifError();
    }

    const resepRows = await tx
      .select()
      .from(resepMenu)
      .where(inArray(resepMenu.menuId, menuIds));

    const requiredByBahan = getRequiredIngredients(input.items, resepRows).sort((a, b) =>
      a.bahanBakuId.localeCompare(b.bahanBakuId)
    );

    const bahanIds = requiredByBahan.map((r) => r.bahanBakuId);
    const bahanRows = bahanIds.length
      ? await tx
          .select()
          .from(bahanBaku)
          .where(inArray(bahanBaku.id, bahanIds))
          .orderBy(asc(bahanBaku.id))
          .for("update")
      : [];
    const bahanMap = new Map(bahanRows.map((b) => [b.id, b]));

    const shortages: { nama: string; butuh: number; tersedia: number; satuan: string }[] = [];
    for (const { bahanBakuId, qtyDipakai: need } of requiredByBahan) {
      const b = bahanMap.get(bahanBakuId);
      const tersedia = b ? Number(b.stokSaatIni) : 0;
      if (tersedia < need) {
        shortages.push({ nama: b?.nama ?? "?", butuh: need, tersedia, satuan: b?.satuan ?? "" });
      }
    }
    if (shortages.length > 0) {
      throw new StokTidakCukupError(shortages);
    }

    for (const { bahanBakuId, qtyDipakai: need } of requiredByBahan) {
      await tx
        .update(bahanBaku)
        .set({ stokSaatIni: sql`${bahanBaku.stokSaatIni} - ${need}`, updatedAt: new Date() })
        .where(eq(bahanBaku.id, bahanBakuId));
    }

    const hargaAktif = hargaAktifSubquery(tx);
    const resepWithHarga = await tx
      .select({
        menuId: resepMenu.menuId,
        bahanBakuId: resepMenu.bahanBakuId,
        takaran: resepMenu.takaran,
        hanyaBawaPulang: resepMenu.hanyaBawaPulang,
        hargaPerSatuan: hargaAktif.hargaPerSatuan,
      })
      .from(resepMenu)
      .leftJoin(hargaAktif, eq(hargaAktif.bahanBakuId, resepMenu.bahanBakuId))
      .where(inArray(resepMenu.menuId, menuIds));

    const hargaByBahan = new Map(
      resepWithHarga.map((recipe) => [recipe.bahanBakuId, recipe.hargaPerSatuan ?? 0])
    );

    let totalPemasukan = 0;
    const detailValues = input.items.map((item) => {
      const m = menuMap.get(item.menuId)!;
      const hargaJualSaatItu = Number(m.hargaJual);
      const hppSaatItu = calculateRecipeHpp(item.menuId, resepWithHarga, hargaByBahan, item.bawaPulang);
      totalPemasukan += hargaJualSaatItu * item.qty;
      return {
        menuId: item.menuId,
        qty: item.qty,
        bawaPulang: item.bawaPulang,
        hargaJualSaatItu: hargaJualSaatItu.toFixed(2),
        hppSaatItu: hppSaatItu.toFixed(2),
      };
    });

    const [row] = await tx
      .insert(transaksi)
      .values({
        tanggal: now,
        totalPemasukan: totalPemasukan.toFixed(2),
        metodeBayar: input.metodeBayar,
        setelahTutup,
        pelakuId,
      })
      .returning();

    for (let index = 0; index < detailValues.length; index += 1) {
      const detailValue = detailValues[index];
      const [detailRow] = await tx
        .insert(detailTransaksi)
        .values({ ...detailValue, transaksiId: row.id })
        .returning();
      const snapshots = getRecipeConsumptionSnapshots(input.items[index], resepRows);
      if (snapshots.length > 0) {
        await tx.insert(detailTransaksiBahan).values(
          snapshots.map((snapshot) => ({
            detailTransaksiId: detailRow.id,
            bahanBakuId: snapshot.bahanBakuId,
            qtyDipakai: snapshot.qtyDipakai.toFixed(2),
          }))
        );
      }
    }

    // Hutang baru masuk Keuangan lewat pembayaran (lihat lib/hutang-core.ts) — stok
    // sudah dipotong di atas seperti biasa, barang sudah keluar terlepas dari metode bayar.
    if (input.metodeBayar === "hutang") {
      await tx.insert(hutang).values({
        transaksiId: row.id,
        namaPelanggan: input.namaPelanggan,
        jumlah: totalPemasukan.toFixed(2),
      });
    }

    return row;
  });
}

async function applyVoid(
  tx: DbOrTx,
  id: string,
  alasan: string,
  voidedBy: string
) {
  const [row] = await tx.select().from(transaksi).where(eq(transaksi.id, id)).for("update");
  if (!row) return null;
  if (row.status === "void") throw new TransaksiSudahVoidError();
  if (row.status !== "menunggu_void" && row.status !== "aktif") {
    throw new TransaksiTidakDapatDiajukanVoidError();
  }

  // Void hanya sampai sini lewat owner (void langsung atau persetujuan). Jika hutang sudah ada
  // pembayarannya, pembayaran dibatalkan otomatis dan jejaknya tetap ada (lihat hutang-core.ts).
  if (row.metodeBayar === "hutang") {
    await batalkanHutangSaatVoidTx(tx, id, voidedBy);
  }

  const details = await tx.select().from(detailTransaksi).where(eq(detailTransaksi.transaksiId, id));
  const snapshots = details.length
    ? await tx
        .select({
          bahanBakuId: detailTransaksiBahan.bahanBakuId,
          qtyDipakai: detailTransaksiBahan.qtyDipakai,
        })
        .from(detailTransaksiBahan)
        .where(inArray(detailTransaksiBahan.detailTransaksiId, details.map((d) => d.id)))
    : [];
  const restoreByBahan = aggregateConsumptionSnapshots(snapshots).sort((a, b) =>
    a.bahanBakuId.localeCompare(b.bahanBakuId)
  );

  for (const { bahanBakuId, qtyDipakai: amount } of restoreByBahan) {
    await tx
      .update(bahanBaku)
      .set({ stokSaatIni: sql`${bahanBaku.stokSaatIni} + ${amount}`, updatedAt: new Date() })
      .where(eq(bahanBaku.id, bahanBakuId));
  }

  const [updated] = await tx
    .update(transaksi)
    .set({ status: "void", voidedAt: new Date(), voidedBy, voidReason: alasan })
    .where(eq(transaksi.id, id))
    .returning();

  return updated;
}

/** Void langsung oleh owner atau penyelesaian pengajuan yang disetujui. */
export async function voidTransaksi(id: string, alasan: string, pelakuId: string) {
  await requireRole("owner");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(transaksi).where(eq(transaksi.id, id)).for("update");
    if (!row) return null;
    if (row.status === "void") throw new TransaksiSudahVoidError();
    if (row.status !== "aktif") throw new PengajuanVoidSedangMenungguError();
    return applyVoid(tx, id, alasan, pelakuId);
  });
}

export async function ajukanVoidTransaksi(id: string, alasan: string, pelakuId: string) {
  await requireRole("owner", "cashier");
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(transaksi).where(eq(transaksi.id, id)).for("update");
    if (!row) return null;
    if (row.status !== "aktif") throw new TransaksiTidakDapatDiajukanVoidError();

    // Hutang yang sudah ada pembayarannya tidak bisa diajukan void oleh kasir (ditangani owner).
    if (row.metodeBayar === "hutang") {
      await pastikanHutangBisaDiajukanVoidTx(tx, id);
    }

    const [request] = await tx
      .insert(pengajuanVoid)
      .values({ transaksiId: id, alasan, diajukanOleh: pelakuId })
      .returning();

    await tx.update(transaksi).set({ status: "menunggu_void" }).where(eq(transaksi.id, id));
    return request;
  });
}

export async function putuskanPengajuanVoid(
  id: string,
  keputusan: "setujui" | "tolak",
  pelakuId: string
) {
  await requireRole("owner");
  return db.transaction(async (tx) => {
    const [request] = await tx.select().from(pengajuanVoid).where(eq(pengajuanVoid.id, id)).for("update");
    if (!request) return null;
    if (request.status !== "menunggu") throw new PengajuanVoidSudahDiprosesError();

    const [row] = await tx.select().from(transaksi).where(eq(transaksi.id, request.transaksiId)).for("update");
    if (!row || row.status !== "menunggu_void") throw new PengajuanVoidSudahDiprosesError();

    const diputuskanAt = new Date();
    await tx
      .update(pengajuanVoid)
      .set({
        status: keputusan === "setujui" ? "disetujui" : "ditolak",
        diputuskanOleh: pelakuId,
        diputuskanAt,
      })
      .where(eq(pengajuanVoid.id, request.id));

    if (keputusan === "tolak") {
      const [updated] = await tx
        .update(transaksi)
        .set({ status: "aktif" })
        .where(eq(transaksi.id, row.id))
        .returning();
      return updated;
    }

    return applyVoid(tx, row.id, request.alasan, pelakuId);
  });
}

/** Riwayat transaksi hari ini (WIB) — dipakai halaman Transaksi untuk daftar + aksi void. */
export async function listTransaksiTujuhHari() {
  await requireRole("owner", "cashier");
  const { start, end } = getRangeLastNDaysWIB(7);
  const rows = await db
    .select({ transaksi, pelakuNama: user.name })
    .from(transaksi)
    .leftJoin(user, eq(transaksi.pelakuId, user.id))
    .where(and(gte(transaksi.tanggal, start), lt(transaksi.tanggal, end)))
    .orderBy(desc(transaksi.tanggal));

  if (rows.length === 0) return [];

  const pendingRequests = await db
    .select({
      transaksiId: pengajuanVoid.transaksiId,
      alasan: pengajuanVoid.alasan,
      diajukanAt: pengajuanVoid.diajukanAt,
      diajukanOlehNama: user.name,
    })
    .from(pengajuanVoid)
    .leftJoin(user, eq(user.id, pengajuanVoid.diajukanOleh))
    .where(
      and(
        eq(pengajuanVoid.status, "menunggu"),
        inArray(
          pengajuanVoid.transaksiId,
          rows.map((r) => r.transaksi.id)
        )
      )
    );
  const pendingByTransaction = new Map(pendingRequests.map((request) => [request.transaksiId, request]));

  const details = await db
    .select({
      transaksiId: detailTransaksi.transaksiId,
      menuId: detailTransaksi.menuId,
      qty: detailTransaksi.qty,
      bawaPulang: detailTransaksi.bawaPulang,
      hargaJualSaatItu: detailTransaksi.hargaJualSaatItu,
      menuNama: menu.nama,
    })
    .from(detailTransaksi)
    .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
    .where(
      inArray(
        detailTransaksi.transaksiId,
        rows.map((r) => r.transaksi.id)
      )
    );

  return rows.map(({ transaksi: row, pelakuNama }) => ({
    ...row,
    pelakuNama,
    pengajuanVoid: pendingByTransaction.get(row.id) ?? null,
    items: details.filter((d) => d.transaksiId === row.id),
  }));
}

export async function listPengajuanVoidMenunggu(now: Date = new Date()) {
  await requireRole("owner");
  const rows = await db
    .select({ pengajuanVoid, transaksi, diajukanOlehNama: user.name })
    .from(pengajuanVoid)
    .innerJoin(transaksi, eq(transaksi.id, pengajuanVoid.transaksiId))
    .leftJoin(user, eq(user.id, pengajuanVoid.diajukanOleh))
    .where(eq(pengajuanVoid.status, "menunggu"))
    .orderBy(desc(pengajuanVoid.diajukanAt));

  if (rows.length === 0) return [];

  const details = await db
    .select({
      transaksiId: detailTransaksi.transaksiId,
      menuNama: menu.nama,
      qty: detailTransaksi.qty,
      bawaPulang: detailTransaksi.bawaPulang,
    })
    .from(detailTransaksi)
    .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
    .where(inArray(detailTransaksi.transaksiId, rows.map((row) => row.transaksi.id)));

  return rows.map(({ pengajuanVoid: request, transaksi: transaction, diajukanOlehNama }) => ({
    ...request,
    umurMenit: Math.max(0, Math.floor((now.getTime() - request.diajukanAt.getTime()) / 60_000)),
    diajukanOlehNama,
    transaksi: {
      id: transaction.id,
      tanggal: transaction.tanggal,
      totalPemasukan: transaction.totalPemasukan,
      metodeBayar: transaction.metodeBayar,
      items: details.filter((detail) => detail.transaksiId === transaction.id),
    },
  }));
}
