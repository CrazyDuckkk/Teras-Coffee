import { and, eq, gte, inArray, isNull, lt, ne, or, sql } from "drizzle-orm";
import type { db } from "@/db";
import {
  bahanBaku,
  detailTransaksi,
  hutang,
  hutangPembayaran,
  menu,
  penyesuaianStok,
  penyesuaianStokDetail,
  stockMasuk,
  transaksi,
  tutupKasir,
  user,
} from "@/db/schema";
import { getTodayDateStringWIB } from "@/lib/date";
import { toSen } from "@/lib/hutang-core";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export type PeriodeLaporan = "mingguan" | "bulanan";

export interface RentangLaporan {
  periode: PeriodeLaporan;
  start: Date;
  end: Date;
  tanggalMulai: string;
  tanggalAkhir: string;
  tanggalAcuan: string;
}

function parseTanggal(tanggal?: string, now: Date = new Date()) {
  const kandidat = /^\d{4}-\d{2}-\d{2}$/.test(tanggal ?? "") ? tanggal! : getTodayDateStringWIB(now);
  const [tahun, bulan, hari] = kandidat.split("-").map(Number);
  const tanggalValid = new Date(Date.UTC(tahun, bulan - 1, hari));
  if (
    tanggalValid.getUTCFullYear() !== tahun ||
    tanggalValid.getUTCMonth() !== bulan - 1 ||
    tanggalValid.getUTCDate() !== hari
  ) {
    return getTodayDateStringWIB(now);
  }
  return kandidat;
}

function tanggalUtc(tahun: number, bulanIndex: number, hari: number) {
  return new Date(Date.UTC(tahun, bulanIndex, hari));
}

function tanggalStr(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buatRentangLaporan(
  periode: PeriodeLaporan,
  tanggal?: string,
  now: Date = new Date(),
): RentangLaporan {
  const tanggalAcuan = parseTanggal(tanggal, now);
  const [tahun, bulan, hari] = tanggalAcuan.split("-").map(Number);
  let awal: Date;
  let akhir: Date;

  if (periode === "bulanan") {
    awal = tanggalUtc(tahun, bulan - 1, 1);
    akhir = tanggalUtc(tahun, bulan, 1);
  } else {
    const weekday = tanggalUtc(tahun, bulan - 1, hari).getUTCDay();
    const mundurKeSenin = (weekday + 6) % 7;
    awal = tanggalUtc(tahun, bulan - 1, hari - mundurKeSenin);
    akhir = tanggalUtc(
      awal.getUTCFullYear(),
      awal.getUTCMonth(),
      awal.getUTCDate() + 7,
    );
  }

  const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
  const start = new Date(awal.getTime() - WIB_OFFSET_MS);
  const end = new Date(akhir.getTime() - WIB_OFFSET_MS);
  const akhirInklusif = new Date(akhir.getTime() - 24 * 60 * 60 * 1000);

  return {
    periode,
    start,
    end,
    tanggalMulai: tanggalStr(awal),
    tanggalAkhir: tanggalStr(akhirInklusif),
    tanggalAcuan,
  };
}

function dalamRentang(date: Date | null, range: RentangLaporan) {
  return date !== null && date >= range.start && date < range.end;
}

function rupiah(cents: number) {
  return cents / 100;
}

function tambah(map: Map<string, number>, key: string, value: number) {
  map.set(key, (map.get(key) ?? 0) + value);
}

function selisihHari(tanggalAwal: string, tanggalAkhir: string) {
  const awal = Date.parse(`${tanggalAwal}T00:00:00Z`);
  const akhir = Date.parse(`${tanggalAkhir}T00:00:00Z`);
  return Math.max(0, Math.floor((akhir - awal) / (24 * 60 * 60 * 1000)));
}

export async function getLaporanKeuanganCore(range: RentangLaporan, query: DbOrTx) {
  const transaksiRows = await query
    .select({
      id: transaksi.id,
      tanggal: transaksi.tanggal,
      totalPemasukan: transaksi.totalPemasukan,
      metodeBayar: transaksi.metodeBayar,
      status: transaksi.status,
      voidReason: transaksi.voidReason,
      namaKasir: user.name,
      tanggalLunas: hutang.tanggalLunas,
      statusHutang: hutang.status,
    })
    .from(transaksi)
    .leftJoin(hutang, eq(hutang.transaksiId, transaksi.id))
    .leftJoin(user, eq(user.id, transaksi.pelakuId))
    .where(
      or(
        and(gte(transaksi.tanggal, range.start), lt(transaksi.tanggal, range.end)),
        and(
          eq(transaksi.metodeBayar, "hutang"),
          eq(hutang.status, "lunas"),
          gte(hutang.tanggalLunas, range.start),
          lt(hutang.tanggalLunas, range.end),
        ),
      ),
    );

  const transaksiIds = transaksiRows.map((row) => row.id);
  const detailRows = transaksiIds.length
    ? await query
        .select({
          transaksiId: detailTransaksi.transaksiId,
          menuId: detailTransaksi.menuId,
          namaMenu: menu.nama,
          kategori: menu.kategori,
          qty: detailTransaksi.qty,
          hargaJual: detailTransaksi.hargaJualSaatItu,
          hpp: detailTransaksi.hppSaatItu,
          bawaPulang: detailTransaksi.bawaPulang,
        })
        .from(detailTransaksi)
        .innerJoin(menu, eq(menu.id, detailTransaksi.menuId))
        .where(inArray(detailTransaksi.transaksiId, transaksiIds))
    : [];

  const pembayaranRows = await query
    .select({
      id: hutangPembayaran.id,
      dibayarAt: hutangPembayaran.dibayarAt,
      jumlah: hutangPembayaran.jumlah,
      metode: hutangPembayaran.metode,
      namaPelanggan: hutang.namaPelanggan,
      namaKasir: user.name,
    })
    .from(hutangPembayaran)
    .innerJoin(hutang, eq(hutang.id, hutangPembayaran.hutangId))
    .innerJoin(transaksi, eq(transaksi.id, hutang.transaksiId))
    .leftJoin(user, eq(user.id, hutangPembayaran.pelakuId))
    .where(
      and(
        isNull(hutangPembayaran.dibatalkanAt),
        ne(transaksi.status, "void"),
        gte(hutangPembayaran.dibayarAt, range.start),
        lt(hutangPembayaran.dibayarAt, range.end),
      ),
    );

  const stockRows = await query
    .select({
      id: stockMasuk.id,
      tanggal: stockMasuk.tanggal,
      namaBahan: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      qty: stockMasuk.qty,
      hargaBeli: stockMasuk.hargaBeli,
      totalPengeluaran: stockMasuk.totalPengeluaran,
      dibayarDari: stockMasuk.dibayarDari,
      statusHarga: stockMasuk.statusHarga,
      dibatalkanAt: stockMasuk.dibatalkanAt,
      alasanBatal: stockMasuk.alasanBatal,
      namaKasir: user.name,
    })
    .from(stockMasuk)
    .innerJoin(bahanBaku, eq(bahanBaku.id, stockMasuk.bahanBakuId))
    .leftJoin(user, eq(user.id, stockMasuk.pelakuId))
    .where(and(gte(stockMasuk.tanggal, range.start), lt(stockMasuk.tanggal, range.end)));

  const penyesuaianRows = await query
    .select({
      id: penyesuaianStok.id,
      tanggal: penyesuaianStok.createdAt,
      jenis: penyesuaianStok.jenis,
      alasan: penyesuaianStok.alasan,
      namaMenu: menu.nama,
      bawaPulang: penyesuaianStok.bawaPulang,
      namaPelaku: user.name,
      namaBahan: bahanBaku.nama,
      satuan: bahanBaku.satuan,
      perubahanQty: penyesuaianStokDetail.perubahanQty,
      hargaPerSatuan: penyesuaianStokDetail.hargaPerSatuan,
      nilaiSusut: penyesuaianStokDetail.nilaiSusut,
    })
    .from(penyesuaianStok)
    .innerJoin(penyesuaianStokDetail, eq(penyesuaianStokDetail.penyesuaianStokId, penyesuaianStok.id))
    .innerJoin(bahanBaku, eq(bahanBaku.id, penyesuaianStokDetail.bahanBakuId))
    .leftJoin(menu, eq(menu.id, penyesuaianStok.menuId))
    .leftJoin(user, eq(user.id, penyesuaianStok.pelakuId))
    .where(and(gte(penyesuaianStok.createdAt, range.start), lt(penyesuaianStok.createdAt, range.end)));

  const tutupRows = await query
    .select()
    .from(tutupKasir)
    .where(and(gte(tutupKasir.tanggal, range.tanggalMulai), lt(tutupKasir.tanggal, tanggalStr(new Date(range.end.getTime() + 7 * 60 * 60 * 1000)))));

  const hutangRows = await query
    .select({
      id: hutang.id,
      namaPelanggan: hutang.namaPelanggan,
      jumlah: hutang.jumlah,
      tanggalHutang: hutang.tanggalHutang,
    })
    .from(hutang)
    .innerJoin(transaksi, eq(transaksi.id, hutang.transaksiId))
    .where(and(ne(transaksi.status, "void"), lt(hutang.tanggalHutang, range.end)));

  const hutangIds = hutangRows.map((row) => row.id);
  const pembayaranSampaiAkhir = hutangIds.length
    ? await query
        .select({
          hutangId: hutangPembayaran.hutangId,
          jumlah: sql<string>`coalesce(sum(${hutangPembayaran.jumlah}), 0)`,
        })
        .from(hutangPembayaran)
        .where(
          and(
            inArray(hutangPembayaran.hutangId, hutangIds),
            isNull(hutangPembayaran.dibatalkanAt),
            lt(hutangPembayaran.dibayarAt, range.end),
          ),
        )
        .groupBy(hutangPembayaran.hutangId)
    : [];

  const pembayaranByHutang = new Map(pembayaranSampaiAkhir.map((row) => [row.hutangId, toSen(row.jumlah)]));
  const piutang = hutangRows
    .map((row) => {
      const jumlah = toSen(row.jumlah);
      const dibayar = pembayaranByHutang.get(row.id) ?? 0;
      const sisa = Math.max(0, jumlah - dibayar);
      return {
        namaPelanggan: row.namaPelanggan ?? "Tanpa nama",
        jumlah: rupiah(jumlah),
        dibayar: rupiah(dibayar),
        sisa: rupiah(sisa),
        umurHari: selisihHari(getTodayDateStringWIB(row.tanggalHutang), range.tanggalAkhir),
      };
    })
    .filter((row) => row.sisa > 0)
    .sort((a, b) => b.umurHari - a.umurHari);

  const transaksiAktif = transaksiRows.filter((row) => row.status !== "void");
  const detailByTransaksi = new Map<string, typeof detailRows>();
  const labaByTransaksi = new Map<string, number>();
  for (const detail of detailRows) {
    const list = detailByTransaksi.get(detail.transaksiId) ?? [];
    list.push(detail);
    detailByTransaksi.set(detail.transaksiId, list);
    tambah(
      labaByTransaksi,
      detail.transaksiId,
      (toSen(detail.hargaJual) - toSen(detail.hpp)) * detail.qty,
    );
  }

  const tanggalBaris = new Map<string, {
    tanggal: string;
    penjualanTunai: number;
    penjualanQris: number;
    penjualanHutang: number;
    pembayaranHutang: number;
    labaDiakui: number;
    stockMasuk: number;
    susut: number;
    selisihKas: number | null;
    selisihQris: number | null;
    statusTutup: string;
  }>();
  for (let offset = 0; ; offset += 1) {
    const day = new Date(range.start.getTime() + offset * 24 * 60 * 60 * 1000);
    if (day >= range.end) break;
    const tanggal = getTodayDateStringWIB(day);
    tanggalBaris.set(tanggal, {
      tanggal,
      penjualanTunai: 0,
      penjualanQris: 0,
      penjualanHutang: 0,
      pembayaranHutang: 0,
      labaDiakui: 0,
      stockMasuk: 0,
      susut: 0,
      selisihKas: null,
      selisihQris: null,
      statusTutup: "Belum ditutup",
    });
  }

  const penjualanPerMetodeSen = { tunai: 0, qris: 0, hutang: 0 };
  let penjualanTunaiSen = 0;
  let penjualanQrisSen = 0;
  let pembayaranTunaiSen = 0;
  let pembayaranQrisSen = 0;
  let totalPengeluaranSen = 0;

  for (const row of transaksiAktif) {
    if (dalamRentang(row.tanggal, range)) {
      const jumlah = toSen(row.totalPemasukan);
      penjualanPerMetodeSen[row.metodeBayar] += jumlah;
      const daily = tanggalBaris.get(getTodayDateStringWIB(row.tanggal));
      if (row.metodeBayar === "tunai") {
        penjualanTunaiSen += jumlah;
        if (daily) daily.penjualanTunai += rupiah(jumlah);
      } else if (row.metodeBayar === "qris") {
        penjualanQrisSen += jumlah;
        if (daily) daily.penjualanQris += rupiah(jumlah);
      } else {
        if (daily) daily.penjualanHutang += rupiah(jumlah);
      }
    }

    const tanggalLaba = row.metodeBayar === "hutang" ? row.tanggalLunas : row.tanggal;
    if (
      (row.metodeBayar !== "hutang" || row.statusHutang === "lunas") &&
      dalamRentang(tanggalLaba, range)
    ) {
      const labaSen = labaByTransaksi.get(row.id) ?? 0;
      const dailyLaba = tanggalBaris.get(getTodayDateStringWIB(tanggalLaba!));
      if (dailyLaba) dailyLaba.labaDiakui += rupiah(labaSen);
    }
  }

  const cashBook: {
    id: string;
    tanggal: Date;
    tipe: "pemasukan" | "pengeluaran";
    metode: string;
    deskripsi: string;
    jumlah: number;
    pelaku: string | null;
  }[] = [];

  for (const row of transaksiAktif) {
    if (!dalamRentang(row.tanggal, range) || (row.metodeBayar !== "tunai" && row.metodeBayar !== "qris")) {
      continue;
    }
    cashBook.push({
      id: row.id,
      tanggal: row.tanggal,
      tipe: "pemasukan",
      metode: row.metodeBayar,
      deskripsi: "Penjualan",
      jumlah: Number(row.totalPemasukan),
      pelaku: row.namaKasir,
    });
  }

  for (const row of pembayaranRows) {
    const jumlah = toSen(row.jumlah);
    if (row.metode === "tunai") pembayaranTunaiSen += jumlah;
    else pembayaranQrisSen += jumlah;
    const daily = tanggalBaris.get(getTodayDateStringWIB(row.dibayarAt));
    if (daily) daily.pembayaranHutang += rupiah(jumlah);
    cashBook.push({
      id: row.id,
      tanggal: row.dibayarAt,
      tipe: "pemasukan",
      metode: row.metode,
      deskripsi: `Pelunasan hutang${row.namaPelanggan ? ` — ${row.namaPelanggan}` : ""}`,
      jumlah: rupiah(jumlah),
      pelaku: row.namaKasir,
    });
  }

  for (const row of stockRows) {
    const dateKey = getTodayDateStringWIB(row.tanggal);
    const daily = tanggalBaris.get(dateKey);
    if (!row.dibatalkanAt) {
      const jumlah = toSen(row.totalPengeluaran);
      totalPengeluaranSen += jumlah;
      if (daily) daily.stockMasuk += rupiah(jumlah);
      cashBook.push({
        id: row.id,
        tanggal: row.tanggal,
        tipe: "pengeluaran",
        metode: row.dibayarDari ?? "sumber tidak diketahui",
        deskripsi: `Stock Masuk — ${row.namaBahan} (${row.qty} ${row.satuan})`,
        jumlah: rupiah(jumlah),
        pelaku: row.namaKasir,
      });
    }
  }

  let totalSusutSen = 0;
  const performance = new Map<string, {
    menuId: string;
    nama: string;
    kategori: string;
    porsiDineIn: number;
    porsiBawaPulang: number;
    omzetSen: number;
    hppSen: number;
    labaSen: number;
  }>();
  for (const row of transaksiAktif) {
    const tanggalLaba = row.metodeBayar === "hutang" ? row.tanggalLunas : row.tanggal;
    if (
      (row.metodeBayar === "hutang" && row.statusHutang !== "lunas") ||
      !dalamRentang(tanggalLaba, range)
    ) continue;

    for (const detail of detailByTransaksi.get(row.id) ?? []) {
      const current = performance.get(detail.menuId) ?? {
        menuId: detail.menuId,
        nama: detail.namaMenu,
        kategori: detail.kategori,
        porsiDineIn: 0,
        porsiBawaPulang: 0,
        omzetSen: 0,
        hppSen: 0,
        labaSen: 0,
      };
      const omzet = toSen(detail.hargaJual) * detail.qty;
      const hpp = toSen(detail.hpp) * detail.qty;
      if (detail.bawaPulang) current.porsiBawaPulang += detail.qty;
      else current.porsiDineIn += detail.qty;
      current.omzetSen += omzet;
      current.hppSen += hpp;
      current.labaSen += omzet - hpp;
      performance.set(detail.menuId, current);
    }
  }

  for (const row of penyesuaianRows) {
    const dateKey = getTodayDateStringWIB(row.tanggal);
    const daily = tanggalBaris.get(dateKey);
    const nilaiSusut = toSen(row.nilaiSusut);
    totalSusutSen += nilaiSusut;
    if (daily) daily.susut += rupiah(nilaiSusut);
  }

  for (const row of tutupRows) {
    const daily = tanggalBaris.get(row.tanggal);
    if (!daily) continue;
    daily.selisihKas = row.selisihKas === null ? null : Number(row.selisihKas);
    daily.selisihQris = row.selisihQris === null ? null : Number(row.selisihQris);
    daily.statusTutup = row.statusPenutupan === "otomatis_belum_diverifikasi"
      ? "Ditutup otomatis · belum diverifikasi"
      : row.statusPenutupan === "manual"
        ? "Ditutup manual"
        : "Data penutupan lama";
  }

  const transaksiLaporan = transaksiRows
    .flatMap((row) => (detailByTransaksi.get(row.id) ?? []).map((detail) => ({
      transaksiId: row.id,
      tanggal: row.tanggal,
      namaKasir: row.namaKasir ?? "Tidak diketahui",
      metode: row.metodeBayar,
      namaMenu: detail.namaMenu,
      qty: detail.qty,
      hargaJual: Number(detail.hargaJual),
      hpp: Number(detail.hpp),
      bawaPulang: detail.bawaPulang,
      status: row.status,
      tanggalLunas: row.tanggalLunas,
      alasanVoid: row.voidReason,
    })))
    .sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());

  const stockDanSusut = [
    ...stockRows.map((row) => ({
      id: row.id,
      tanggal: row.tanggal,
      tipe: "Stock Masuk" as const,
      rincian: `${row.namaBahan} (${row.qty} ${row.satuan})`,
      perubahan: Number(row.qty),
      nilai: Number(row.totalPengeluaran),
      status: row.dibatalkanAt ? `Dikoreksi: ${row.alasanBatal ?? ""}` : `Harga ${row.statusHarga}`,
      pelaku: row.namaKasir,
    })),
    ...penyesuaianRows.map((row) => ({
      id: row.id,
      tanggal: row.tanggal,
      tipe: `Penyesuaian: ${row.jenis}` as const,
      rincian: `${row.namaBahan} (${row.perubahanQty} ${row.satuan})${row.namaMenu ? ` · ${row.namaMenu}` : ""}`,
      perubahan: Number(row.perubahanQty),
      nilai: Number(row.nilaiSusut),
      status: row.alasan,
      pelaku: row.namaPelaku,
    })),
  ].sort((a, b) => a.tanggal.getTime() - b.tanggal.getTime());

  const selisihKasSen = tutupRows.reduce(
    (sum, row) => sum + (row.statusPenutupan === "manual" ? toSen(row.selisihKas ?? 0) : 0),
    0,
  );
  const selisihQrisSen = tutupRows.reduce(
    (sum, row) => sum + (row.statusPenutupan === "manual" ? toSen(row.selisihQris ?? 0) : 0),
    0,
  );
  const transaksiVoid = transaksiRows.filter((row) => row.status === "void" && dalamRentang(row.tanggal, range)).length;
  const labaDiakuiSen = [...tanggalBaris.values()].reduce((sum, day) => sum + toSen(day.labaDiakui), 0);
  const pembayaranHutangSen = pembayaranTunaiSen + pembayaranQrisSen;
  const penjualanCashQrisSen = penjualanTunaiSen + penjualanQrisSen;
  const totalPemasukanSen = penjualanCashQrisSen + pembayaranHutangSen;

  return {
    range,
    ringkasan: {
      penjualanPerMetode: {
        tunai: rupiah(penjualanPerMetodeSen.tunai),
        qris: rupiah(penjualanPerMetodeSen.qris),
        hutang: rupiah(penjualanPerMetodeSen.hutang),
      },
      pembayaranHutang: {
        tunai: rupiah(pembayaranTunaiSen),
        qris: rupiah(pembayaranQrisSen),
        total: rupiah(pembayaranHutangSen),
      },
      totalPemasukan: rupiah(totalPemasukanSen),
      totalPengeluaran: rupiah(totalPengeluaranSen),
      labaDiakui: rupiah(labaDiakuiSen),
      biayaSusut: rupiah(totalSusutSen),
      pengeluaranLain: 0,
      dasarBagiHasil: rupiah(labaDiakuiSen - totalSusutSen),
      totalPiutang: piutang.reduce((sum, row) => sum + toSen(row.sisa), 0) / 100,
      selisihKas: rupiah(selisihKasSen),
      selisihQris: rupiah(selisihQrisSen),
      hariTutupOtomatis: tutupRows.filter((row) => row.statusPenutupan === "otomatis_belum_diverifikasi").length,
      jumlahVoid: transaksiVoid,
    },
    bukuKas: cashBook.sort((a, b) => b.tanggal.getTime() - a.tanggal.getTime()),
    kasHarian: [...tanggalBaris.values()].map((row) => ({
      ...row,
      penjualanTunai: Number(row.penjualanTunai.toFixed(2)),
      penjualanQris: Number(row.penjualanQris.toFixed(2)),
      penjualanHutang: Number(row.penjualanHutang.toFixed(2)),
      pembayaranHutang: Number(row.pembayaranHutang.toFixed(2)),
      labaDiakui: Number(row.labaDiakui.toFixed(2)),
      stockMasuk: Number(row.stockMasuk.toFixed(2)),
      susut: Number(row.susut.toFixed(2)),
    })),
    performaMenu: [...performance.values()]
      .map((row) => ({
        menuId: row.menuId,
        nama: row.nama,
        kategori: row.kategori,
        porsiDineIn: row.porsiDineIn,
        porsiBawaPulang: row.porsiBawaPulang,
        omzet: rupiah(row.omzetSen),
        hpp: rupiah(row.hppSen),
        laba: rupiah(row.labaSen),
        marginPersen: row.omzetSen > 0 ? (row.labaSen / row.omzetSen) * 100 : 0,
      }))
      .sort((a, b) => b.laba - a.laba),
    transaksi: transaksiLaporan,
    stockDanSusut,
    piutang,
  };
}
