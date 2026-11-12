import { and, asc, count, desc, eq, gte, isNull, lt, ne, sql } from "drizzle-orm";
import type { db } from "@/db";
import {
  bahanBaku,
  hutang,
  hutangPembayaran,
  pengajuanVoid,
  stockMasuk,
  transaksi,
  tutupKasir,
} from "@/db/schema";
import { getTodayDateStringWIB, getTodayRangeWIB } from "@/lib/date";
import { toSen } from "@/lib/hutang-core";
import { buatRentangLaporan, getLaporanKeuanganCore } from "@/lib/laporan-keuangan-core";

type DbOrTx = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const DAY_MS = 24 * 60 * 60 * 1000;
const HUTANG_LAMA_HARI = 30;
const JUMLAH_HUTANG_LAMA_DITAMPILKAN = 5;

function ordinalTanggalWIB(tanggal: string) {
  const [tahun, bulan, hari] = tanggal.split("-").map(Number);
  return Date.UTC(tahun, bulan - 1, hari);
}

function umurHariWIB(tanggal: Date, now: Date) {
  return Math.max(
    0,
    Math.floor(
      (ordinalTanggalWIB(getTodayDateStringWIB(now)) - ordinalTanggalWIB(getTodayDateStringWIB(tanggal))) /
        DAY_MS,
    ),
  );
}

function umurMenit(tanggal: Date | null, now: Date) {
  return tanggal === null ? null : Math.max(0, Math.floor((now.getTime() - tanggal.getTime()) / 60_000));
}

const jumlahDibayarAktif = sql<string>`coalesce((
  select sum(${hutangPembayaran.jumlah})
  from ${hutangPembayaran}
  where ${hutangPembayaran.hutangId} = ${hutang.id}
    and ${hutangPembayaran.dibatalkanAt} is null
), 0)`;

export async function getDashboardSummaryCore(query: DbOrTx, now: Date = new Date()) {
  const hariIni = getTodayRangeWIB(now);
  const tanggalHariIni = getTodayDateStringWIB(now);
  const rangeMinggu = buatRentangLaporan("mingguan", tanggalHariIni, now);
  const laporanMinggu = await getLaporanKeuanganCore(rangeMinggu, query);

  const [
    bahanAktif,
    jumlahPengajuanVoid,
    tanggalPengajuanVoidTertua,
    jumlahStockMasukMenunggu,
    tanggalStockMasukTertua,
    penutupanMinggu,
    jumlahHutangLama,
  ] =
    await Promise.all([
      query.select().from(bahanBaku).where(eq(bahanBaku.isActive, true)),
      query
        .select({ jumlah: count() })
        .from(pengajuanVoid)
        .where(eq(pengajuanVoid.status, "menunggu")),
      query
        .select({ tertua: pengajuanVoid.diajukanAt })
        .from(pengajuanVoid)
        .where(eq(pengajuanVoid.status, "menunggu"))
        .orderBy(asc(pengajuanVoid.diajukanAt))
        .limit(1),
      query
        .select({ jumlah: count() })
        .from(stockMasuk)
        .where(and(eq(stockMasuk.statusHarga, "menunggu"), isNull(stockMasuk.dibatalkanAt))),
      query
        .select({
          tertua: stockMasuk.tanggal,
        })
        .from(stockMasuk)
        .where(and(eq(stockMasuk.statusHarga, "menunggu"), isNull(stockMasuk.dibatalkanAt)))
        .orderBy(asc(stockMasuk.tanggal))
        .limit(1),
      query
        .select({
          tanggal: tutupKasir.tanggal,
          status: tutupKasir.statusPenutupan,
          selisihKas: tutupKasir.selisihKas,
          selisihQris: tutupKasir.selisihQris,
        })
        .from(tutupKasir)
        .where(
          and(
            gte(tutupKasir.tanggal, rangeMinggu.tanggalMulai),
            lt(tutupKasir.tanggal, getTodayDateStringWIB(rangeMinggu.end)),
          ),
        )
        .orderBy(desc(tutupKasir.tanggal)),
      query
        .select({ jumlah: count() })
        .from(hutang)
        .innerJoin(transaksi, eq(transaksi.id, hutang.transaksiId))
        .where(
          and(
            eq(hutang.status, "belum_lunas"),
            ne(transaksi.status, "void"),
            lt(hutang.tanggalHutang, new Date(hariIni.start.getTime() - (HUTANG_LAMA_HARI - 1) * DAY_MS)),
            sql`${hutang.jumlah} > ${jumlahDibayarAktif}`,
          ),
        ),
    ]);

  const stokMenipis = bahanAktif
    .filter((bahan) => Number(bahan.stokSaatIni) <= Number(bahan.batasMinimumStok))
    .sort((a, b) => Number(a.stokSaatIni) - Number(b.stokSaatIni));
  const hariIniLaporan = laporanMinggu.kasHarian.find((row) => row.tanggal === tanggalHariIni);
  const transaksiPerMenu = new Map<string, { nama: string; qty: number }>();
  for (const row of laporanMinggu.transaksi) {
    if (row.status === "void" || row.tanggal < hariIni.start || row.tanggal >= hariIni.end) continue;
    const current = transaksiPerMenu.get(row.namaMenu) ?? { nama: row.namaMenu, qty: 0 };
    current.qty += row.qty;
    transaksiPerMenu.set(row.namaMenu, current);
  }

  const hutangLama = await query
    .select({
      id: hutang.id,
      namaPelanggan: hutang.namaPelanggan,
      tanggalHutang: hutang.tanggalHutang,
      jumlah: hutang.jumlah,
      dibayar: jumlahDibayarAktif,
    })
    .from(hutang)
    .innerJoin(transaksi, eq(transaksi.id, hutang.transaksiId))
    .where(
      and(
        eq(hutang.status, "belum_lunas"),
        ne(transaksi.status, "void"),
        lt(hutang.tanggalHutang, new Date(hariIni.start.getTime() - (HUTANG_LAMA_HARI - 1) * DAY_MS)),
        sql`${hutang.jumlah} > ${jumlahDibayarAktif}`,
      ),
    )
    .orderBy(asc(hutang.tanggalHutang))
    .limit(JUMLAH_HUTANG_LAMA_DITAMPILKAN);

  const [voidTertua] = tanggalPengajuanVoidTertua;
  const [stockTertua] = tanggalStockMasukTertua;
  const totalPenjualanMinggu =
    laporanMinggu.ringkasan.penjualanPerMetode.tunai +
    laporanMinggu.ringkasan.penjualanPerMetode.qris +
    laporanMinggu.ringkasan.penjualanPerMetode.hutang;
  const totalPenjualanHariIni = hariIniLaporan
    ? hariIniLaporan.penjualanTunai + hariIniLaporan.penjualanQris + hariIniLaporan.penjualanHutang
    : 0;

  return {
    omzetHariIni: totalPenjualanHariIni,
    labaDiakuiHariIni: hariIniLaporan?.labaDiakui ?? 0,
    omzetMingguIni: totalPenjualanMinggu,
    labaDiakuiMingguIni: laporanMinggu.ringkasan.labaDiakui,
    stokMenipis,
    menuTerlaris: [...transaksiPerMenu.entries()]
      .sort((a, b) => b[1].qty - a[1].qty)
      .slice(0, 3)
      .map(([, row]) => row),
    perhatian: {
      pengajuanVoid: {
        jumlah: jumlahPengajuanVoid[0]?.jumlah ?? 0,
        umurTertuaMenit: umurMenit(voidTertua?.tertua ?? null, now),
      },
      konfirmasiHarga: {
        jumlah: jumlahStockMasukMenunggu[0]?.jumlah ?? 0,
        umurTertuaMenit: umurMenit(stockTertua?.tertua ?? null, now),
      },
      tutupOtomatis: penutupanMinggu
        .filter((row) => row.status === "otomatis_belum_diverifikasi")
        .map((row) => row.tanggal),
      selisihKasir: penutupanMinggu
        .filter(
          (row) =>
            row.status === "manual" &&
            (Number(row.selisihKas ?? 0) !== 0 || Number(row.selisihQris ?? 0) !== 0),
        )
        .map((row) => ({
          tanggal: row.tanggal,
          selisihKas: Number(row.selisihKas ?? 0),
          selisihQris: Number(row.selisihQris ?? 0),
        })),
      hutangLama: {
        jumlah: jumlahHutangLama[0]?.jumlah ?? 0,
        ambangHari: HUTANG_LAMA_HARI,
        daftar: hutangLama.map((row) => ({
          id: row.id,
          namaPelanggan: row.namaPelanggan,
          sisa: (toSen(row.jumlah) - toSen(row.dibayar)) / 100,
          umurHari: umurHariWIB(row.tanggalHutang, now),
        })),
      },
    },
  };
}
